// Diagnostic : affiche les logs d'une transaction Arc pour voir qui émet le Transfer et avec quelle valeur.
// Usage : npm run inspect -- 0xHASH_DE_LA_TX
import { getClient } from "../lib/watcher";

async function main() {
  const hash = process.argv[2] as `0x${string}` | undefined;
  if (!hash || !hash.startsWith("0x")) {
    console.error("Usage : npm run inspect -- 0xHASH_DE_LA_TX");
    process.exit(1);
  }
  const client = getClient();
  const receipt = await client.getTransactionReceipt({ hash });
  console.log("status :", receipt.status, "| bloc :", receipt.blockNumber.toString());
  console.log("from   :", receipt.from, "| to :", receipt.to);
  console.log(`${receipt.logs.length} log(s) :`);
  for (const [i, log] of receipt.logs.entries()) {
    console.log(`--- log ${i} ---`);
    console.log("emetteur :", log.address);
    console.log("topics   :", log.topics);
    console.log("data     :", log.data);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
