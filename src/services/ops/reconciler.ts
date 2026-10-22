import { log } from "../../utils/logger";
import { Engine } from "./engine";

/** Runs the sweep on an interval. One slow pass never overlaps the next one. */
export function startReconciler(engine: Engine, intervalMs = 30_000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const n = await engine.sweep();
      if (n) log.info("reconciler pass", { open: n });
    } catch (err: any) {
      log.error("reconciler failed", { error: err?.message });
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
