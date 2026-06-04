import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import bcrypt from "bcrypt";
import crypto from "crypto";
import nodemailer from "nodemailer";
import logger from "../lib/logger";

export const specialistsRouter = Router();

// Middleware to ensure only admins can access these routes
specialistsRouter.use(authenticate, (req, res, next) => {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Acceso denegado. Solo administradores pueden gestionar especialistas." });
    return;
  }
  next();
});

const specialistSchema = z.object({
  full_name: z.string().min(1),
  professional_title: z.string().optional(),
  license_number: z.string().optional(),
  email: z.string().email(),
});

const specialistEditSchema = z.object({
  full_name: z.string().min(1).optional(),
  professional_title: z.string().optional(),
  license_number: z.string().optional(),
  profile_photo_url: z.string().optional(),
});

/** GET /specialists */
specialistsRouter.get("/", async (req: Request, res: Response) => {
  const specialists = await prisma.user.findMany({
    where: {
      clinic_id: req.user!.clinic_id,
      role: "SPECIALIST",
    },
    include: {
      _count: {
        select: { consultations: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  const formatted = specialists.map((s) => ({
    id: s.id,
    full_name: s.full_name,
    professional_title: s.professional_title,
    license_number: s.license_number,
    email: s.email,
    is_active: s.is_active,
    profile_photo_url: s.profile_photo_url,
    created_at: s.created_at,
    total_consultations: s._count.consultations,
  }));

  res.json(formatted);
});

/** POST /specialists */
specialistsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = specialistSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR" });
    return;
  }

  const { full_name, professional_title, license_number, email } = parsed.data;

  // Check if email exists
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(400).json({ error: "El correo ya está registrado" });
    return;
  }

  // Generate temporary password
  const tempPassword = crypto.randomBytes(8).toString("hex");
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const newUser = await prisma.user.create({
    data: {
      clinic_id: req.user!.clinic_id,
      role: "SPECIALIST",
      full_name,
      professional_title,
      license_number,
      email,
      password_hash: passwordHash,
      is_active: true,
    },
  });

  // Create password reset token for setting the password
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

  await prisma.passwordResetToken.create({
    data: {
      user_id: newUser.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours for welcome email
    },
  });

  // Send email
  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });
  
  let transporter: nodemailer.Transporter;
  if (clinic?.smtp_host && clinic?.smtp_user && clinic?.smtp_pass) {
    transporter = nodemailer.createTransport({
      host: clinic.smtp_host,
      port: clinic.smtp_port ?? 587,
      secure: (clinic.smtp_port ?? 587) === 465,
      auth: { user: clinic.smtp_user, pass: clinic.smtp_pass },
    });
  } else {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  const resetUrl = `http://localhost:5173/reset-password?token=${rawToken}`;
  const clinicName = clinic?.name ?? "PodoClinic";

  let previewUrl = "";
  try {
    const info = await transporter.sendMail({
      from: `"${clinicName}" <${clinic?.smtp_user ?? "no-reply@podoclinic.com"}>`,
      to: email,
      subject: `Bienvenido a ${clinicName} - Configura tu cuenta`,
      html: `
        <h2>Bienvenido, ${full_name}</h2>
        <p>Has sido registrado como especialista en ${clinicName}.</p>
        <p>Para comenzar, por favor configura tu contraseña haciendo clic en el siguiente enlace:</p>
        <p><a href="${resetUrl}">${resetUrl}</a></p>
        <p>Este enlace expirará en 24 horas.</p>
      `,
    });
    if (process.env.NODE_ENV !== "production") {
      previewUrl = nodemailer.getTestMessageUrl(info) || "";
      logger.info(`[DEV] Welcome email preview: ${previewUrl}`);
    }
  } catch (err) {
    logger.error("Error sending welcome email", err instanceof Error ? err : new Error(String(err)));
  }

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "CREATE_SPECIALIST",
      resource_type: "User",
      resource_id: newUser.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  const safeUser = {
    id: newUser.id,
    email: newUser.email,
    full_name: newUser.full_name,
    professional_title: newUser.professional_title,
    license_number: newUser.license_number,
    role: newUser.role,
    is_active: newUser.is_active,
    clinic_id: newUser.clinic_id,
    created_at: newUser.created_at,
  };

  res.status(201).json({
    ...safeUser,
    ...(process.env.NODE_ENV !== "production" ? { preview_url: previewUrl, dev_reset_url: resetUrl } : {})
  });
});

/** PATCH /specialists/:id */
specialistsRouter.patch("/:id", async (req: Request, res: Response) => {
  const parsed = specialistEditSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos" });
    return;
  }

  const userToEdit = await prisma.user.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id, role: "SPECIALIST" },
  });

  if (!userToEdit) {
    res.status(404).json({ error: "Especialista no encontrado" });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userToEdit.id },
    data: parsed.data,
  });

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "EDIT_SPECIALIST",
      resource_type: "User",
      resource_id: updatedUser.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  const safeUpdated = {
    id: updatedUser.id,
    email: updatedUser.email,
    full_name: updatedUser.full_name,
    professional_title: updatedUser.professional_title,
    license_number: updatedUser.license_number,
    role: updatedUser.role,
    is_active: updatedUser.is_active,
    profile_photo_url: updatedUser.profile_photo_url,
    clinic_id: updatedUser.clinic_id,
    created_at: updatedUser.created_at,
  };

  res.json(safeUpdated);
});

/** POST /specialists/:id/deactivate */
specialistsRouter.post("/:id/deactivate", async (req: Request, res: Response) => {
  const userToDeactivate = await prisma.user.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id, role: "SPECIALIST" },
  });

  if (!userToDeactivate) {
    res.status(404).json({ error: "Especialista no encontrado" });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userToDeactivate.id },
    data: { is_active: false },
  });

  // Revoke refresh tokens
  await prisma.refreshToken.updateMany({
    where: { user_id: updatedUser.id },
    data: { revoked: true },
  });

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "DEACTIVATE_SPECIALIST",
      resource_type: "User",
      resource_id: updatedUser.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json({ message: "Especialista desactivado", is_active: false });
});

/** POST /specialists/:id/reactivate */
specialistsRouter.post("/:id/reactivate", async (req: Request, res: Response) => {
  const userToReactivate = await prisma.user.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id, role: "SPECIALIST" },
  });

  if (!userToReactivate) {
    res.status(404).json({ error: "Especialista no encontrado" });
    return;
  }

  const updatedUser = await prisma.user.update({
    where: { id: userToReactivate.id },
    data: { is_active: true },
  });

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "REACTIVATE_SPECIALIST",
      resource_type: "User",
      resource_id: updatedUser.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json({ message: "Especialista reactivado", is_active: true });
});
