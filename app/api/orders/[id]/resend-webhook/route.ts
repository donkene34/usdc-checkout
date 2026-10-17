import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendOrderWebhook } from "@/lib/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // l'envoi peut durer ~21s de retries

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    select: { status: true },
  });
  if (!order) {
    return NextResponse.json({ error: "Commande introuvable" }, { status: 404 });
  }
  if (order.status !== "PAID") {
    return NextResponse.json({ error: "Seules les commandes PAID peuvent être renvoyées" }, { status: 400 });
  }

  const delivered = await sendOrderWebhook(params.id);
  return NextResponse.json({ delivered });
}
