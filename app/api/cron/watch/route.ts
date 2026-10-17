import { NextResponse } from "next/server";
import { runWatcher } from "@/lib/watcher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  // Vercel Cron envoie automatiquement "Authorization: Bearer <CRON_SECRET>"
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    return NextResponse.json(await runWatcher());
  } catch (err) {
    console.error("[cron/watch]", err);
    return NextResponse.json({ error: "Erreur du watcher" }, { status: 500 });
  }
}

// Vercel Cron appelle en GET ; POST pour les déclenchements manuels / cron externes
export const GET = handle;
export const POST = handle;
