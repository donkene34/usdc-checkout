"use client";

import { useCallback, useEffect, useState } from "react";

type Order = {
  id: string;
  amount: string;
  currency: string;
  depositAddress: string;
  status: "PENDING" | "PAID" | "EXPIRED" | "FAILED";
  txHash: string | null;
  createdAt: string;
  paidAt: string | null;
};

type Created = {
  orderId: string;
  depositAddress: string;
  amount: string;
  expiresAt: string;
  webhookSecret: string;
};

const FILTERS = ["ALL", "PENDING", "PAID", "EXPIRED", "FAILED"] as const;
type Filter = (typeof FILTERS)[number];

const BADGE: Record<Order["status"], string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  PAID: "bg-green-100 text-green-800",
  EXPIRED: "bg-gray-200 text-gray-700",
  FAILED: "bg-red-100 text-red-800",
};

const POLL_MS = 5000;

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [resend, setResend] = useState<Record<string, "loading" | "ok" | "fail">>({});

  // Formulaire "Nouvelle commande"
  const [amount, setAmount] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setOrders(await res.json());
      setError(false);
      setLoaded(true);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    loadOrders();
    const id = setInterval(loadOrders, POLL_MS);
    return () => clearInterval(id);
  }, [loadOrders]);

  // URL du marchand de test par défaut (dépend de window, donc après le premier rendu)
  useEffect(() => {
    setWebhookUrl(`${window.location.origin}/api/webhook-test`);
  }, []);

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");
    setCreated(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount.trim(), merchantWebhookUrl: webhookUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error ?? "Erreur lors de la création");
      } else {
        setCreated(data);
        setAmount("");
        loadOrders();
      }
    } catch {
      setFormError("Serveur injoignable");
    } finally {
      setSubmitting(false);
    }
  }

  async function resendWebhook(orderId: string) {
    setResend((prev) => ({ ...prev, [orderId]: "loading" }));
    try {
      const res = await fetch(`/api/orders/${orderId}/resend-webhook`, { method: "POST" });
      const data = await res.json();
      setResend((prev) => ({ ...prev, [orderId]: res.ok && data.delivered ? "ok" : "fail" }));
    } catch {
      setResend((prev) => ({ ...prev, [orderId]: "fail" }));
    }
  }

  const visible = filter === "ALL" ? orders : orders.filter((o) => o.status === filter);
  const count = (f: Filter) => (f === "ALL" ? orders.length : orders.filter((o) => o.status === f).length);

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Dashboard marchand</h1>
            <p className="text-sm text-gray-500">
              Mise à jour toutes les {POLL_MS / 1000}s{" "}
              {error && <span className="text-red-600">· erreur de chargement</span>}
            </p>
          </div>
          <a href="/webhook-logs" className="text-sm text-blue-700 underline">
            Voir les webhooks
          </a>
        </header>

        <section className="rounded-xl bg-white p-5 shadow">
          <h2 className="mb-3 text-lg font-semibold">Nouvelle commande</h2>
          <form onSubmit={createOrder} className="grid gap-3 sm:grid-cols-[160px_1fr_auto] sm:items-end">
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">Montant (USDC)</span>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                placeholder="1.00"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-gray-500">URL du webhook du marchand</span>
              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                type="url"
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {submitting ? "Création…" : "Créer la commande"}
            </button>
          </form>
          {formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}
          {created && (
            <div className="mt-4 rounded-lg bg-green-50 p-4 text-sm text-green-900">
              <p className="font-semibold">
                Commande créée : {created.amount} USDC, valable jusqu&apos;à{" "}
                {new Date(created.expiresAt).toLocaleTimeString()}
              </p>
              <p className="mt-1">
                <a
                  href={`/checkout/${created.orderId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline"
                >
                  Ouvrir la page de paiement
                </a>
              </p>
              <p className="mt-2 text-xs text-green-800">
                Secret du webhook (affiché une seule fois, sert à vérifier X-Signature) :
              </p>
              <p className="break-all font-mono text-xs">{created.webhookSecret}</p>
            </div>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${
                filter === f ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {f === "ALL" ? "Toutes" : f} ({count(f)})
            </button>
          ))}
        </div>

        <div className="overflow-x-auto rounded-xl bg-white shadow">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-gray-500">
              <tr>
                <th className="p-3">Commande</th>
                <th className="p-3">Statut</th>
                <th className="p-3">Montant</th>
                <th className="p-3">Adresse de dépôt</th>
                <th className="p-3">Créée le</th>
                <th className="p-3">Transaction</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {!loaded && (
                <tr>
                  <td colSpan={7} className="p-4 text-gray-500">
                    Chargement…
                  </td>
                </tr>
              )}
              {loaded && visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-4 text-gray-500">
                    Aucune commande.
                  </td>
                </tr>
              )}
              {visible.map((o) => {
                const state = resend[o.id];
                return (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="p-3 font-mono text-xs">
                      <a href={`/checkout/${o.id}`} className="text-blue-700 underline">
                        {o.id.slice(0, 10)}…
                      </a>
                    </td>
                    <td className="p-3">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${BADGE[o.status]}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="p-3 font-semibold">
                      {o.amount} {o.currency}
                    </td>
                    <td className="p-3 font-mono text-xs" title={o.depositAddress}>
                      {o.depositAddress.slice(0, 8)}…{o.depositAddress.slice(-6)}
                    </td>
                    <td className="p-3">{new Date(o.createdAt).toLocaleString()}</td>
                    <td className="p-3 font-mono text-xs">
                      {o.txHash ? (
                        <a
                          href={`https://explorer.testnet.arc.io/tx/${o.txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-700 underline"
                          title={o.txHash}
                        >
                          {o.txHash.slice(0, 10)}…
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {o.status === "PAID" && (
                        <div className="flex items-center justify-end gap-2">
                          {state === "ok" && <span className="text-xs text-green-700">Livré ✓</span>}
                          {state === "fail" && <span className="text-xs text-red-700">Échec ✗</span>}
                          <button
                            onClick={() => resendWebhook(o.id)}
                            disabled={state === "loading"}
                            className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                          >
                            {state === "loading" ? "Envoi…" : "Renvoyer le webhook"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
