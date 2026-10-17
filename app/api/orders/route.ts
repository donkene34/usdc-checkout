import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Liste des 100 dernières commandes pour le dashboard (sans secret ni URL de webhook)
export async function GET() {
  const orders = await prisma.order.findMany({ orderBy: { createdAt: "desc" }, take: 100 });

  return NextResponse.json(
    orders.map((o) => ({
      id: o.id,
      amount: o.amount.toString(),
      currency: o.currency,
      depositAddress: o.depositAddress,
      status: o.status,
      txHash: o.txHash,
      createdAt: o.createdAt.toISOString(),
      expiresAt: o.expiresAt.toISOString(),
      paidAt: o.paidAt?.toISOString() ?? null,
    }))
  );
}
