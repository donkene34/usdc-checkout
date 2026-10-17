import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { verifySignature } from "@/lib/webhook";

export const dynamic = "force-dynamic";

// Simule le serveur d'un marchand : reçoit le webhook, vérifie la signature HMAC, journalise.
export async function POST(req: Request) {
  const raw = await req.text(); // la signature porte sur le corps BRUT
  const signature = req.headers.get("x-signature");

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = { raw };
  }

  let valid = false;
  const orderId = (payload as { orderId?: unknown } | null)?.orderId;
  if (typeof orderId === "string" && signature) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { webhookSecret: true },
    });
    if (order) valid = verifySignature(raw, signature, order.webhookSecret);
  }

  await prisma.receivedWebhook.create({
    data: { payload: payload as Prisma.InputJsonValue, signature, valid },
  });

  // 401 si la signature est fausse : un vrai marchand rejetterait la requête
  return NextResponse.json({ received: true, valid }, { status: valid ? 200 : 401 });
}

// Alimente la page /webhook-logs (démo) : webhooks reçus + tentatives d'envoi
export async function GET() {
  const [received, sent] = await Promise.all([
    prisma.receivedWebhook.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.webhookLog.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return NextResponse.json({ received, sent });
}
