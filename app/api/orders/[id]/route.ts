import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }

  // Route publique (page checkout) : on n'expose ni webhookSecret ni merchantWebhookUrl
  return NextResponse.json({
    id: order.id,
    amount: order.amount.toString(),
    currency: order.currency,
    depositAddress: order.depositAddress,
    status: order.status,
    txHash: order.txHash,
    createdAt: order.createdAt.toISOString(),
    expiresAt: order.expiresAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
  });
}
