/**
 * Job automático de reset para el entorno demo.
 * Si DEMO_MODE=true, ejecuta el seed cada 24 horas para
 * limpiar todos los datos y recargar el estado inicial ficticio.
 *
 * Se invoca desde src/index.ts al arrancar el servidor.
 */

import { execSync } from "child_process";
import path from "path";
import logger from "../lib/logger";

const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 horas

export function startDemoResetJob() {
  if (process.env.DEMO_MODE !== "true") return;

  logger.info("[DEMO] Modo demo activo — reset automático cada 24h programado.");

  // Calcular cuándo será el próximo reset (próximo múltiplo de 24h desde medianoche UTC)
  function scheduleNextReset() {
    const now = new Date();
    const nextReset = new Date(now);
    nextReset.setUTCHours(3, 0, 0, 0); // 03:00 UTC = medianoche Chile (GMT-3/4)
    if (nextReset <= now) {
      nextReset.setUTCDate(nextReset.getUTCDate() + 1);
    }
    const msUntilReset = nextReset.getTime() - now.getTime();

    logger.info(`[DEMO] Próximo reset programado: ${nextReset.toISOString()} (en ${Math.round(msUntilReset / 1000 / 60)} minutos)`);

    setTimeout(() => {
      runSeedDemo();
      // Después del primer reset, repetir cada 24h exactas
      setInterval(runSeedDemo, INTERVAL_MS);
    }, msUntilReset);
  }

  scheduleNextReset();
}

function runSeedDemo() {
  logger.info("[DEMO] 🔄 Ejecutando reset de datos demo...");
  try {
    const seedPath = path.resolve(__dirname, "../seedDemo.ts");
    // ts-node busca el archivo relativo al CWD del proceso
    execSync("npx ts-node src/seedDemo.ts", {
      cwd: path.resolve(__dirname, "../../.."),
      stdio: "inherit",
      env: { ...process.env },
    });
    logger.info("[DEMO] ✅ Reset de datos demo completado exitosamente.");
  } catch (err) {
    logger.error("[DEMO] ❌ Error en reset de datos demo:", err instanceof Error ? err : new Error(String(err)));
  }
}
