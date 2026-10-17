// DEV UNIQUEMENT : marque une commande PENDING comme payée et déclenche le webhook, sans passer par la blockchain.
// Usage : npm run simulate -- <orderId>
import { prisma } from "../lib/prisma";
import { sendOrderWebhook } from "../lib/webhook";

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Interdit en production");

  const orderId = process.argv[2];
  if (!orderId) {
    console.error("Usage : npm run simulate -- <orderId>");
    process.exit(1);
  }

  const res = await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "PAID", txHash: "0xSIMULATED", paidAt: new Date() },
  });
  if (res.count === 0) {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    console.error(order ? `Commande déjà en statut ${order.status}, rien à simuler.` : "Commande introuvable.");
    process.exit(1);
  }

  console.log("Commande passée en PAID, envoi du webhook (jusqu'à ~21s si le marchand ne répond pas)…");
  const ok = await sendOrderWebhook(orderId);
  console.log(ok ? "Webhook livré (2xx)." : "Webhook non livré après toutes les tentatives.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
