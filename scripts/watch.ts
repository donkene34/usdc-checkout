import { runWatcher } from "../lib/watcher";

const INTERVAL_MS = 10_000;

async function main() {
  console.log(`Watcher démarré, passage toutes les ${INTERVAL_MS / 1000}s (Ctrl+C pour arrêter)`);
  while (true) {
    try {
      const r = await runWatcher();
      console.log(
        `[${new Date().toLocaleTimeString()}] bloc ${r.scannedUpTo}/${r.latestBlock} | payées: ${r.paid.length} | expirées: ${r.expired}`
      );
    } catch (err) {
      console.error("Erreur watcher:", err);
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

main();
