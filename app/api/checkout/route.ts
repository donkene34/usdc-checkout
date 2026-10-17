import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deriveDepositAddress } from "@/lib/hdwallet";

const ORDER_TTL_MS = 30 * 60 * 1000;
// Montant positif, 6 décimales max (précision de l'USDC)
const AMOUNT_RE = /^\d+(\.\d{1,6})?$/;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const { amount, merchantWebhookUrl } = (body ?? {}) as {
    amount?: unknown;
    merchantWebhookUrl?: unknown;
  };

  const amountStr = typeof amount === "number" || typeof amount === "string" ? String(amount) : "";
  if (!AMOUNT_RE.test(amountStr) || Number(amountStr) <= 0) {
    return NextResponse.json(
      { error: "amount doit être un nombre > 0 avec 6 décimales max" },
      { status: 400 }
    );
  }

  let url: URL;
  try {
    url = new URL(String(merchantWebhookUrl));
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
  } catch {
    return NextResponse.json(
      { error: "merchantWebhookUrl doit être une URL http(s) valide" },
      { status: 400 }
    );
  }

  const webhookSecret = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ORDER_TTL_MS);

  // addressIndex est attribué par la base (autoincrement, sans collision).
  // On crée donc l'Order puis on dérive l'adresse dans la même transaction.
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        amount: amountStr,
        depositAddress: "",
        merchantWebhookUrl: url.toString(),
        webhookSecret,
        expiresAt,
      },
    });
    return tx.order.update({
      where: { id: created.id },
      data: { depositAddress: deriveDepositAddress(created.addressIndex) },
    });
  });

  return NextResponse.json(
    {
      orderId: order.id,
      depositAddress: order.depositAddress,
      amount: order.amount.toString(),
      expiresAt: order.expiresAt.toISOString(),
      // Retourné une seule fois : le marchand en a besoin pour vérifier X-Signature
      webhookSecret,
    },
    { status: 201 }
  );
}
