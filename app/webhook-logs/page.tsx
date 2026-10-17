"use client";

import { useEffect, useState } from "react";

type Received = {
  id: string;
  payload: unknown;
  signature: string | null;
  valid: boolean;
  createdAt: string;
};
type Sent = {
  id: string;
  orderId: string;
  attempt: number;
  responseStatus: number | null;
  createdAt: string;
};

const POLL_MS = 3000;

export default function WebhookLogsPage() {
  const [received, setReceived] = useState<Received[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const res = await fetch("/api/webhook-test", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!stopped) {
          setReceived(data.received);
          setSent(data.sent);
          setError(false);
        }
      } catch {
        if (!stopped) setError(true);
      }
    }
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="min-h-screen bg-gray-100 p-6 text-gray-900">
      <div className="mx-auto max-w-4xl space-y-8">
        <header>
          <h1 className="text-2xl font-bold">Webhooks</h1>
          <p className="text-sm text-gray-500">
            Mise à jour toutes les {POLL_MS / 1000}s {error && <span className="text-red-600">· erreur de chargement</span>}
          </p>
        </header>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Reçus par le marchand de test ({received.length})</h2>
          <div className="space-y-3">
            {received.length === 0 && <p className="text-sm text-gray-500">Aucun webhook reçu pour l&apos;instant.</p>}
            {received.map((r) => (
              <div key={r.id} className="rounded-xl bg-white p-4 shadow">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{new Date(r.createdAt).toLocaleString()}</span>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      r.valid ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {r.valid ? "Signature valide ✓" : "Signature invalide ✗"}
                  </span>
                </div>
                <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-3 text-xs">
                  {JSON.stringify(r.payload, null, 2)}
                </pre>
                <p className="mt-2 break-all font-mono text-xs text-gray-500">
                  X-Signature : {r.signature ?? "(absente)"}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-lg font-semibold">Tentatives d&apos;envoi ({sent.length})</h2>
          <div className="overflow-x-auto rounded-xl bg-white shadow">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-gray-50 text-gray-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Commande</th>
                  <th className="p-3">Tentative</th>
                  <th className="p-3">Réponse</th>
                </tr>
              </thead>
              <tbody>
                {sent.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-3 text-gray-500">
                      Aucune tentative pour l&apos;instant.
                    </td>
                  </tr>
                )}
                {sent.map((s) => {
                  const ok = s.responseStatus !== null && s.responseStatus >= 200 && s.responseStatus < 300;
                  return (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="p-3">{new Date(s.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-mono text-xs">{s.orderId}</td>
                      <td className="p-3">{s.attempt}</td>
                      <td className={`p-3 font-semibold ${ok ? "text-green-700" : "text-red-700"}`}>
                        {s.responseStatus ?? "injoignable"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
