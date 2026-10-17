import { createPublicClient, defineChain, getAddress, http, parseAbiItem, parseUnits } from "viem";
import { prisma } from "./prisma";
import { sendOrderWebhook } from "./webhook";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://explorer.testnet.arc.io" } },
});

// Sur Arc, les envois natifs de USDC (MetaMask, etc.) émettent un Transfer ERC-20 depuis cette adresse
// système (EIP-7708). Vérifié sur une vraie transaction : la valeur y est en 18 décimales (1 USDC = 1e18).
const ARC_SYSTEM_EMITTER = "0xfffffffffffffffffffffffffffffffffffffffe";
const NATIVE_DECIMALS = 18;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);
const USDC_DECIMALS = 6; // interface ERC-20 du contrat USDC
const MAX_BLOCKS_PER_BATCH = 2000n; // limite de plage getLogs des RPC publics
const MAX_BATCHES_PER_RUN = 10; // garde-fou pour rester dans le temps d'une fonction serverless
const LOOKBACK = 5000n; // fenêtre max rescannée (les blocs Arc font moins d'1s, une commande dure 30 min)
const STATE_ID = "singleton";

export type WatchResult = {
  latestBlock: string;
  scannedUpTo: string;
  paid: string[];
  expired: number;
};

export function getClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(process.env.RPC_URL || arcTestnet.rpcUrls.default.http[0]),
  });
}

async function saveCursor(block: bigint) {
  await prisma.watcherState.upsert({
    where: { id: STATE_ID },
    create: { id: STATE_ID, lastScannedBlock: block },
    update: { lastScannedBlock: block },
  });
}

export async function runWatcher(): Promise<WatchResult> {
  const usdc = process.env.USDC_CONTRACT_ADDRESS;
  if (!usdc) throw new Error("USDC_CONTRACT_ADDRESS manquant dans .env");

  // Seuls ces émetteurs sont acceptés : sinon un faux token pourrait simuler un paiement
  const emitters = [getAddress(usdc), getAddress(ARC_SYSTEM_EMITTER)];
  const client = getClient();

  const pending = await prisma.order.findMany({ where: { status: "PENDING" } });
  const latest = await client.getBlockNumber();
  const state = await prisma.watcherState.findUnique({ where: { id: STATE_ID } });

  // Curseur = dernier bloc scanné. Jamais plus de LOOKBACK blocs en arrière
  // (une commande expire en 30 min), pour ne pas rattraper des heures d'historique.
  const floor = latest > LOOKBACK ? latest - LOOKBACK : 0n;
  let cursor = state ? state.lastScannedBlock : floor;
  if (cursor < floor) cursor = floor;

  const byAddress = new Map(pending.map((o) => [o.depositAddress.toLowerCase(), o]));
  const paid: string[] = [];
  let batches = 0;

  while (cursor < latest && batches < MAX_BATCHES_PER_RUN) {
    const from = cursor + 1n;
    const to = from + MAX_BLOCKS_PER_BATCH - 1n < latest ? from + MAX_BLOCKS_PER_BATCH - 1n : latest;

    // Sans commande en attente, rien à chercher : on avance juste le curseur
    if (byAddress.size > 0) {
      const logs = await client.getLogs({
        address: emitters,
        event: TRANSFER_EVENT,
        args: { to: [...byAddress.values()].map((o) => o.depositAddress as `0x${string}`) },
        fromBlock: from,
        toBlock: to,
      });

      for (const log of logs) {
        const { to: dest, value } = log.args;
        if (!dest || value === undefined) continue;

        const order = byAddress.get(dest.toLowerCase());
        if (!order) continue;

        // La précision de `value` dépend de l'émetteur : 18 décimales (système) ou 6 (contrat USDC)
        const decimals =
          log.address.toLowerCase() === ARC_SYSTEM_EMITTER ? NATIVE_DECIMALS : USDC_DECIMALS;
        const expected = parseUnits(order.amount.toFixed(USDC_DECIMALS), decimals);
        if (value < expected) continue; // montant insuffisant : la commande reste PENDING

        // updateMany conditionnel : si deux passages se chevauchent, un seul gagne
        const res = await prisma.order.updateMany({
          where: { id: order.id, status: "PENDING" },
          data: { status: "PAID", txHash: log.transactionHash, paidAt: new Date() },
        });
        byAddress.delete(dest.toLowerCase());

        if (res.count === 1) {
          paid.push(order.id);
          try {
            await sendOrderWebhook(order.id);
          } catch (err) {
            console.error(`[watcher] webhook en échec pour ${order.id}`, err);
          }
        }
      }
    }

    cursor = to;
    batches++;
    await saveCursor(cursor);
  }

  // Les commandes encore PENDING après expiration passent en EXPIRED
  const expired = await prisma.order.updateMany({
    where: { status: "PENDING", expiresAt: { lt: new Date() } },
    data: { status: "EXPIRED" },
  });

  return {
    latestBlock: latest.toString(),
    scannedUpTo: cursor.toString(),
    paid,
    expired: expired.count,
  };
}
