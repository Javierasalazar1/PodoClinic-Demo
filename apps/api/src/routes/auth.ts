import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import speakeasy from "speakeasy";
import qrcode from "qrcode";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import logger from "../lib/logger";
import { encryptField, decryptField } from "../lib/crypto";
import { createTransporter, getFromAddress } from "../lib/mailer";

export const authRouter = Router();



const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totp_code: z.string().optional(),
});

function generateAccessToken(payload: { sub: string; email: string; role: string; clinic_id: string }) {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, { expiresIn: "15m" });
}

function generateRefreshToken() {
  return crypto.randomBytes(48).toString("hex");
}

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Iniciar sesión
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               totp_code:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login exitoso
 *       400:
 *         description: Datos inválidos
 *       401:
 *         description: Credenciales incorrectas
 */
authRouter.post("/login", async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  const { email, password, totp_code } = parsed.data;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.is_active) {
      res.status(401).json({ error: "Credenciales incorrectas", code: "INVALID_CREDENTIALS" });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      res.status(401).json({ error: "Credenciales incorrectas", code: "INVALID_CREDENTIALS" });
      return;
    }

    // 2FA check — omitido para usuario demo en modo demo
    const isDemoUser =
      process.env.DEMO_MODE === "true" &&
      email === (process.env.DEMO_USER_EMAIL ?? "demo@Podelyx.cl");

    if (!isDemoUser && user.totp_enabled && user.totp_secret) {
      if (!totp_code) {
        res.status(200).json({ requiresTotp: true });
        return;
      }
      const decryptedSecret = decryptField(user.totp_secret);
      const valid = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: "base32",
        token: totp_code,
        window: 1,
      });
      if (!valid) {
        res.status(401).json({ error: "Código 2FA inválido", code: "INVALID_TOTP" });
        return;
      }
    }

    // Issue tokens
    const accessToken = generateAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
      clinic_id: user.clinic_id,
    });
    const rawRefreshToken = generateRefreshToken();
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        clinic_id: user.clinic_id,
        action: "LOGIN",
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    });

    res.cookie("refreshToken", rawRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        clinic_id: user.clinic_id,
        professional_title: user.professional_title,
        license_number: user.license_number,
        totp_enabled: user.totp_enabled,
      },
    });
  } catch (err) {
    logger.error("Login error", err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: "Error interno", code: "INTERNAL_ERROR" });
  }
});

/** POST /auth/refresh */
authRouter.post("/refresh", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    res.status(401).json({ error: "refreshToken requerido en cookie", code: "UNAUTHORIZED" });
    return;
  }

  const tokenHash = crypto.createHash("sha256").update(refreshToken).digest("hex");
  const stored = await prisma.refreshToken.findFirst({
    where: { token_hash: tokenHash, revoked: false },
  });

  if (!stored || stored.expires_at < new Date()) {
    res.status(401).json({ error: "Refresh token inválido o expirado", code: "INVALID_TOKEN" });
    return;
  }

  // Rotate: revoke old, issue new
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revoked: true } });

  const user = await prisma.user.findUnique({ where: { id: stored.user_id } });
  if (!user || !user.is_active) {
    res.status(401).json({ error: "Usuario no encontrado o inactivo", code: "UNAUTHORIZED" });
    return;
  }

  const accessToken = generateAccessToken({ sub: user.id, email: user.email, role: user.role, clinic_id: user.clinic_id });
  const newRaw = generateRefreshToken();
  const newHash = crypto.createHash("sha256").update(newRaw).digest("hex");

  await prisma.refreshToken.create({
    data: {
      user_id: user.id,
      token_hash: newHash,
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  res.cookie("refreshToken", newRaw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  res.json({
    accessToken,
    user: {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      clinic_id: user.clinic_id,
      professional_title: user.professional_title,
      license_number: user.license_number,
      totp_enabled: user.totp_enabled,
    },
  });
});

/** POST /auth/logout */
authRouter.post("/logout", async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;
  if (refreshToken) {
    const hash = crypto.createHash("sha256").update(refreshToken).digest("hex");
    await prisma.refreshToken.updateMany({ where: { token_hash: hash }, data: { revoked: true } }).catch(() => {});
  }

  // Try to extract user info from the access token for audit logging,
  // but don't block logout if the token is missing or expired
  try {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // Decode without verifying expiry so we can still log the event
      const payload = jwt.decode(token) as { sub?: string; clinic_id?: string } | null;
      if (payload?.sub && payload?.clinic_id) {
        await prisma.auditLog.create({
          data: {
            user_id: payload.sub,
            clinic_id: payload.clinic_id,
            action: "LOGOUT",
            ip_address: req.ip ?? "",
            user_agent: req.headers["user-agent"] ?? "",
          },
        }).catch(() => {});
      }
    }
  } catch {
    // Ignore any errors — logout must always succeed
  }

  res.cookie("refreshToken", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(0),
  });

  res.json({ message: "Sesión cerrada" });
});

/** POST /auth/2fa/setup */
authRouter.post("/2fa/setup", authenticate, async (req: Request, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) { res.status(404).json({ error: "Usuario no encontrado", code: "NOT_FOUND" }); return; }

  const secret = speakeasy.generateSecret({ name: `Podelyx (${user.email})`, length: 20 });
  const encrypted = encryptField(secret.base32);
  await prisma.user.update({ where: { id: user.id }, data: { totp_secret: encrypted, totp_enabled: false } });

  const qrUrl = await qrcode.toDataURL(secret.otpauth_url ?? "");
  res.json({ qr: qrUrl, secret: secret.base32 });
});

/** POST /auth/2fa/verify */
authRouter.post("/2fa/verify", authenticate, async (req: Request, res: Response) => {
  const { code } = req.body as { code?: string };
  if (!code) { res.status(400).json({ error: "Código requerido", code: "VALIDATION_ERROR" }); return; }

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user?.totp_secret) { res.status(400).json({ error: "Configura 2FA primero", code: "TOTP_NOT_SETUP" }); return; }

  const decrypted = decryptField(user.totp_secret);
  const valid = speakeasy.totp.verify({ secret: decrypted, encoding: "base32", token: code, window: 1 });
  if (!valid) { res.status(401).json({ error: "Código inválido", code: "INVALID_TOTP" }); return; }

  await prisma.user.update({ where: { id: user.id }, data: { totp_enabled: true } });
  res.json({ message: "2FA activado correctamente" });
});

/** POST /auth/2fa/disable */
authRouter.post("/2fa/disable", authenticate, async (req: Request, res: Response) => {
  const { currentPassword } = req.body as { currentPassword?: string };
  if (!currentPassword) {
    res.status(400).json({ error: "Contraseña requerida", code: "VALIDATION_ERROR" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado", code: "NOT_FOUND" });
    return;
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!passwordMatch) {
    res.status(401).json({ error: "La contraseña actual es incorrecta", code: "INVALID_CREDENTIALS" });
    return;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { totp_enabled: false, totp_secret: null },
  });

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      clinic_id: user.clinic_id,
      action: "DISABLE_2FA",
      resource_type: "User",
      resource_id: user.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json({ message: "2FA desactivado correctamente" });
});

/** POST /auth/forgot-password */
authRouter.post("/forgot-password", async (req: Request, res: Response) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email inválido", code: "VALIDATION_ERROR" });
    return;
  }

  const { email } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (!user || !user.is_active) {
    res.json({ message: "Si el correo está registrado, se han enviado las instrucciones." });
    return;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  });

  // En modo demo, no se envía correo real
  if (process.env.DEMO_MODE === "true") {
    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        clinic_id: user.clinic_id,
        action: "FORGOT_PASSWORD_REQUESTED",
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    });
    res.json({
      message: "Si el correo está registrado, se han enviado las instrucciones.",
      demo_blocked: true,
      demo_recipient: email,
    });
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: user.clinic_id } });
  
  const transporter = await createTransporter(clinic);

  const resetUrl = `http://localhost:5173/reset-password?token=${rawToken}`;
  const clinicName = clinic?.name ?? "Podelyx";

  let previewUrl = "";
  try {
    const info = await transporter.sendMail({
      from: `"${clinicName}" <${clinic?.smtp_user ?? "no-reply@Podelyx.com"}>`,
      to: email,
      subject: "Recuperación de contraseña",
      html: `<p>Hola ${user.full_name},</p><p>Has solicitado recuperar tu contraseña. Haz clic en el enlace para restablecerla:</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>Este enlace expirará en 1 hora.</p>`,
    });
    
    if (process.env.NODE_ENV !== "production") {
      previewUrl = nodemailer.getTestMessageUrl(info) || "";
      logger.info(`[DEV] Reset email preview URL: ${previewUrl}`);
    }
  } catch (err) {
    logger.error("Error sending reset email", err instanceof Error ? err : new Error(String(err)));
  }

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      clinic_id: user.clinic_id,
      action: "FORGOT_PASSWORD_REQUESTED",
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json({ 
    message: "Si el correo está registrado, se han enviado las instrucciones.",
    ...(process.env.NODE_ENV !== "production" ? { preview_url: previewUrl, dev_reset_url: resetUrl } : {})
  });
});

/** POST /auth/reset-password */
authRouter.post("/reset-password", async (req: Request, res: Response) => {
  const schema = z.object({
    token: z.string().min(1),
    newPassword: z.string().min(8),
  });
  
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR" });
    return;
  }

  const { token, newPassword } = parsed.data;
  const cleanToken = token.trim();
  const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");

  const resetToken = await prisma.passwordResetToken.findFirst({
    where: { token_hash: tokenHash },
    include: { user: true },
  });

  if (!resetToken) {
    res.status(400).json({ error: "Token inválido", code: "INVALID_TOKEN" });
    return;
  }

  if (resetToken.used_at) {
    res.status(400).json({ error: "El token ya fue utilizado", code: "USED_TOKEN" });
    return;
  }

  if (resetToken.expires_at < new Date()) {
    res.status(400).json({ error: "El token ha expirado", code: "EXPIRED_TOKEN" });
    return;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: resetToken.user_id },
      data: { password_hash: newPasswordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used_at: new Date() },
    }),
    prisma.refreshToken.updateMany({
      where: { user_id: resetToken.user_id, revoked: false },
      data: { revoked: true },
    }),
    prisma.auditLog.create({
      data: {
        user_id: resetToken.user_id,
        clinic_id: resetToken.user.clinic_id,
        action: "PASSWORD_RESET",
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    }),
  ]);

  res.json({ message: "Contraseña actualizada correctamente" });
});

/** POST /auth/change-password */
authRouter.post("/change-password", authenticate, async (req: Request, res: Response) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8)
      .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
      .regex(/[0-9]/, "Debe contener al menos un número")
      .regex(/[\W_]/, "Debe contener al menos un símbolo"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado", code: "NOT_FOUND" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "La contraseña actual es incorrecta", code: "INVALID_CREDENTIALS" });
    return;
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newPasswordHash },
    }),
    prisma.refreshToken.updateMany({
      where: { user_id: user.id, revoked: false },
      data: { revoked: true },
    }),
    prisma.auditLog.create({
      data: {
        user_id: user.id,
        clinic_id: user.clinic_id,
        action: "CHANGE_PASSWORD",
        resource_type: "User",
        resource_id: user.id,
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    }),
  ]);

  res.json({ message: "Contraseña actualizada correctamente" });
});

/** POST /auth/change-email - Inicia el flujo de cambio de correo */
authRouter.post("/change-email", authenticate, async (req: Request, res: Response) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newEmail: z.string().email(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR" });
    return;
  }

  const { currentPassword, newEmail } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: req.user!.sub } });
  if (!user) {
    res.status(404).json({ error: "Usuario no encontrado", code: "NOT_FOUND" });
    return;
  }

  const valid = await bcrypt.compare(currentPassword, user.password_hash);
  if (!valid) {
    res.status(401).json({ error: "La contraseña actual es incorrecta", code: "INVALID_CREDENTIALS" });
    return;
  }

  // Check if email already in use
  const existingUser = await prisma.user.findUnique({ where: { email: newEmail } });
  if (existingUser) {
    res.status(400).json({ error: "El correo ya está en uso", code: "EMAIL_IN_USE" });
    return;
  }

  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  // @ts-ignore
  await prisma.emailChangeToken.create({
    data: {
      user_id: user.id,
      new_email: newEmail,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    },
  });

  await prisma.auditLog.create({
    data: {
      user_id: user.id,
      clinic_id: user.clinic_id,
      action: "EMAIL_CHANGE_REQUESTED",
      resource_type: "User",
      resource_id: user.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  // En modo demo, no se envía correo real
  if (process.env.DEMO_MODE === "true") {
    res.json({
      message: "Se ha enviado un enlace de verificación al nuevo correo.",
      demo_blocked: true,
      demo_recipient: newEmail,
    });
    return;
  }

  // Enviar email de verificación al nuevo correo
  const clinic = await prisma.clinic.findUnique({ where: { id: user.clinic_id } });
  const transporter = await createTransporter(clinic);

  const verifyUrl = `${req.protocol}://${req.get("host")}/api/v1/auth/verify-email-change/${rawToken}`;
  
  const mailOptions = {
    from: getFromAddress(clinic, "Podelyx Soporte"),
    to: newEmail,
    subject: "Verifica tu nuevo correo electrónico - Podelyx",
    html: `
      <h2>Hola ${user.full_name},</h2>
      <p>Has solicitado cambiar tu correo electrónico en Podelyx a esta dirección.</p>
      <p>Para confirmar y aplicar el cambio, haz clic en el siguiente enlace. Este enlace expira en 24 horas.</p>
      <a href="${verifyUrl}" style="display:inline-block;padding:10px 20px;background:#0F6E56;color:#fff;text-decoration:none;border-radius:5px;">Verificar correo electrónico</a>
      <p>Si no fuiste tú, ignora este mensaje.</p>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  const devUrl = process.env.NODE_ENV !== "production" ? nodemailer.getTestMessageUrl(info) : undefined;

  res.json({ message: "Se ha enviado un enlace de verificación al nuevo correo.", dev_verify_url: devUrl });
});

/** GET /auth/verify-email-change/:token - Aplica el cambio de correo */
authRouter.get("/verify-email-change/:token", async (req: Request, res: Response) => {
  const { token } = req.params;
  const cleanToken = String(token).trim();
  const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");

  // @ts-ignore
  const changeToken = await prisma.emailChangeToken.findFirst({
    where: { token_hash: tokenHash },
    include: { user: true },
  });

  if (!changeToken || changeToken.used_at || changeToken.expires_at < new Date()) {
    res.status(400).send("El enlace es inválido o ha expirado.");
    return;
  }

  const user = changeToken.user;
  const oldEmail = user.email;
  const newEmail = changeToken.new_email;

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail },
    }),
    // @ts-ignore
    prisma.emailChangeToken.update({
      where: { id: changeToken.id },
      data: { used_at: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        user_id: user.id,
        clinic_id: user.clinic_id,
        action: "EMAIL_CHANGE_VERIFIED",
        resource_type: "User",
        resource_id: user.id,
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    }),
  ]);

  // Enviar notificación al correo anterior
  const clinic = await prisma.clinic.findUnique({ where: { id: user.clinic_id } });
  const transporter = await createTransporter(clinic);

  const mailOptions = {
    from: getFromAddress(clinic, "Podelyx Sistema"),
    to: oldEmail,
    subject: "Aviso de seguridad: Tu correo ha sido cambiado",
    html: `
      <h2>Aviso de seguridad importante</h2>
      <p>Hola ${user.full_name},</p>
      <p>Te informamos que tu correo electrónico de acceso a Podelyx ha sido modificado exitosamente.</p>
      <p>Nuevo correo: <strong>${newEmail}</strong></p>
      <p>Si tú no realizaste este cambio, por favor contacta al administrador del sistema inmediatamente.</p>
    `,
  };

  await transporter.sendMail(mailOptions).catch((e: unknown) => {
    logger.error("Error sending old-email notification", e instanceof Error ? e : new Error(String(e)));
  });

  res.redirect("http://localhost:5173/login?emailChanged=true");
});


