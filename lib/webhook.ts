import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";

// 1 envoi initial, puis 3 nouveaux essais après 1s, 5s et 15s (retries inline, ~21s max d'attente)
export const RETRY_DELAYS_MS = [1000, 5000, 15000];
const REQUEST_TIMEOUT_MS = 5000;

/** HMAC-SHA256 hexadécimal du corps brut de la requête. */
export function signPayload(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/** Vérifie X-Signature en temps constant. À utiliser côté marchand sur le corps BRUT reçu. */
export function verifySignature(body: string, signature: string, secret: string): boolean {
  const expected = Buffer.from(signPayload(body, secret), "hex");
  const given = Buffer.from(signature, "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

type DeliverOptions = {
  url: string;
  body: string;
  secret: string;
  delaysMs?: number[];
  timeoutMs?: number;
  /** Appelée après chaque tentative ; status = null si le serveur est injoignable ou trop lent */
  onAttempt: (attempt: number, status: number | null) => Promise<void>;
};

/** Envoie le webhook ; retourne true dès qu'une tentative reçoit un 2xx. */
export async function deliverWithRetry(opts: DeliverOptions): Promise<boolean> {
  const delays = opts.delaysMs ?? RETRY_DELAYS_MS;
  const signature = signPayload(opts.body, opts.secret);

  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    let status: number | null = null;
    try {
      const res = await fetch(opts.url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Signature": signature },
        body: opts.body,
        signal: AbortSignal.timeout(opts.timeoutMs ?? REQUEST_TIMEOUT_MS),
      });
      status = res.status;
    } catch {
      // réseau / timeout : status reste null
    }

    await opts.onAttempt(attempt, status);
    if (status !== null && status >= 200 && status < 300) return true;

    if (attempt <= delays.length) {
      await new Promise((resolve) => setTimeout(resolve, delays[attempt - 1]));
    }
  }
  return false;
}

/** Notifie le marchand qu'une commande est payée. Aussi utilisée par "Renvoyer le webhook". */
export async function sendOrderWebhook(orderId: string): Promise<boolean> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return false;

  const payload = {
    orderId: order.id,
    status: order.status,
    amount: order.amount.toString(),
    txHash: order.txHash,
    timestamp: new Date().toISOString(),
  };
  const body = JSON.stringify(payload);

  return deliverWithRetry({
    url: order.merchantWebhookUrl,
    body,
    secret: order.webhookSecret,
    onAttempt: async (attempt, status) => {
      await prisma.webhookLog.create({
        data: { orderId: order.id, payload, responseStatus: status, attempt },
      });
    },
  });
}
