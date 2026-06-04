import { Request, Response, NextFunction } from "express";
import logger from "../lib/logger";

/**
 * Manejador global de errores.
 * Devuelve siempre el mismo formato: { error, code, details? }
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error("Unhandled error", err instanceof Error ? err : new Error(String(err)));

  if (res.headersSent) return;

  if (err && typeof err === "object" && "code" in err) {
    // Errores de Prisma conocidos
    const prismaErr = err as { code: string; meta?: unknown };
    if (prismaErr.code === "P2002") {
      res.status(409).json({ error: "Recurso ya existe (conflicto de unicidad)", code: "CONFLICT", details: prismaErr.meta });
      return;
    }
    if (prismaErr.code === "P2025") {
      res.status(404).json({ error: "Recurso no encontrado", code: "NOT_FOUND" });
      return;
    }
  }

  res.status(500).json({ error: "Error interno del servidor", code: "INTERNAL_ERROR" });
}
