"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type Order = {
  id: string;
  amount: string;
  currency: string;
  depositAddress: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  txHash: string | null;
  expiresAt: string;
  paidAt: string | null;
};

const POLL_MS = 5000;

function formatCountdown(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function CheckoutPage({ params }: { params: { orderId: string } }) {
  const { orderId } = params;
  const [order, setOrder] = useState<Order | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [qr, setQr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);

  // Polling du statut toutes les 5s, arrêté dès que la commande n'est plus PENDING
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;

    async function tick() {
      let done = false;
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (res.status === 404) {
          if (!stopped) setNotFound(true);
          done = true;
        } else if (res.ok) {
          const data: Order = await res.json();
          if (!stopped) setOrder(data);
          done = data.status !== "PENDING";
        }
      } catch {
        // erreur réseau passagère : on réessaie au prochain tour
      }
      if (!stopped && !done) timer = setTimeout(tick, POLL_MS);
    }

    tick();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [orderId]);

  // Horloge pour le compte à rebours
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // QR code de l'adresse de dépôt
  const address = order?.depositAddress;
  useEffect(() => {
    if (!address) return;
    QRCode.toDataURL(address, { width: 240, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [address]);

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // presse-papiers indisponible : on ignore
    }
  }

  if (notFound) {
    return (
      <Shell>
        <p className="text-center text-lg font-medium text-gray-900">Commande introuvable</p>
      </Shell>
    );
  }

  if (!order) {
    return (
      <Shell>
        <p className="text-center text-gray-500">Chargement…</p>
      </Shell>
    );
  }

  const remaining = Math.max(0, Math.floor((new Date(order.expiresAt).getTime() - now) / 1000));
  const expired = order.status === "EXPIRED" || (order.status === "PENDING" && remaining === 0);
  const paid = order.status === "PAID";
  const failed = order.status === "FAILED";

  return (
    <Shell>
      <div className="text-center">
        <p className="text-sm text-gray-500">Montant à payer</p>
        <p className="mt-1 text-4xl font-bold text-gray-900">
          {order.amount} <span className="text-2xl">{order.currency}</span>
        </p>
      </div>

      {paid ? (
        <div className="mt-6 rounded-xl bg-green-50 p-6 text-center">
          <p className="text-2xl font-semibold text-green-700">Payé ✓</p>
          {order.txHash && (
            <a
              href={`https://explorer.testnet.arc.io/tx/${order.txHash}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block break-all text-sm text-green-700 underline"
            >
              {order.txHash}
            </a>
          )}
        </div>
      ) : expired ? (
        <div className="mt-6 rounded-xl bg-red-50 p-6 text-center">
          <p className="text-2xl font-semibold text-red-700">Expiré</p>
          <p className="mt-1 text-sm text-red-600">N&apos;envoie plus de fonds à cette adresse.</p>
        </div>
      ) : failed ? (
        <div className="mt-6 rounded-xl bg-red-50 p-6 text-center">
          <p className="text-2xl font-semibold text-red-700">Paiement échoué</p>
        </div>
      ) : (
        <>
          <div className="mt-6 flex justify-center">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr} alt="QR code de l'adresse de dépôt" width={240} height={240} />
            ) : (
              <div className="h-60 w-60 animate-pulse rounded bg-gray-100" />
            )}
          </div>

          <p className="mt-4 text-center text-sm text-gray-500">
            Envoie exactement ce montant en USDC sur <strong>Arc Testnet</strong> à :
          </p>
          <button
            onClick={copyAddress}
            className="mt-2 w-full break-all rounded-lg border border-gray-200 bg-gray-50 p-3 text-center font-mono text-sm text-gray-900 hover:bg-gray-100"
            title="Cliquer pour copier"
          >
            {order.depositAddress}
          </button>
          <p className="mt-1 text-center text-xs text-gray-400">{copied ? "Copié ✓" : "Clique pour copier"}</p>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">Expire dans</p>
            <p className="font-mono text-3xl font-semibold text-gray-900">{formatCountdown(remaining)}</p>
            <p className="mt-2 text-xs text-gray-400">En attente du paiement…</p>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">{children}</div>
    </main>
  );
}
