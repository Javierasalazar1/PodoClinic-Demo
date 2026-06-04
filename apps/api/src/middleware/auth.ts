import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

export interface AuthPayload {
  sub: string;      // user id
  clinic_id: string;
  role: "ADMIN" | "SPECIALIST" | "RECEPTION";
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

/**
 * Middleware de autenticación JWT.
 * Verifica el access token y adjunta el payload al request.
 */
export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Token no proporcionado", code: "UNAUTHORIZED" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as AuthPayload;
    // Verify user is still active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { is_active: true },
    });
    if (!user?.is_active) {
      res.status(401).json({ error: "Cuenta desactivada", code: "ACCOUNT_DISABLED" });
      return;
    }
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: "Token inválido o expirado", code: "INVALID_TOKEN" });
  }
}

/**
 * Middleware de autorización por roles.
 */
export function authorize(...roles: Array<"ADMIN" | "SPECIALIST" | "RECEPTION">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "No autenticado", code: "UNAUTHORIZED" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Permisos insuficientes", code: "FORBIDDEN" });
      return;
    }
    next();
  };
}
