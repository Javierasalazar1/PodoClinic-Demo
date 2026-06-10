import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import logger from "../lib/logger";
import { encryptField, decryptField } from "../lib/crypto";
import cloudinary, { extractPublicId } from "../config/cloudinary";

export const clinicRouter = Router();
clinicRouter.use(authenticate);

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      cb(null, `logo-${req.user!.clinic_id}-${Date.now()}${path.extname(file.originalname)}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten imagénes (JPEG, PNG, WEBP, GIF)"));
    }
  },
});

const clinicUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal("")),
  website: z.string().url().optional().or(z.literal("")),
  registration_number: z.string().max(100).optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  consent_text: z.string().optional(),
  smtp_host: z.string().max(200).optional().or(z.literal("")),
  smtp_port: z.number().int().min(1).max(65535).optional().nullable(),
  smtp_user: z.string().max(200).optional().or(z.literal("")),
  smtp_pass: z.string().max(500).optional().or(z.literal("")),
});

/** GET /clinic — devuelve la config de la clínica del usuario en sesión */
clinicRouter.get("/", async (req: Request, res: Response) => {
  const clinic = await prisma.clinic.findUnique({
    where: { id: req.user!.clinic_id },
  });

  if (!clinic) {
    res.status(404).json({ error: "Clínica no encontrada", code: "NOT_FOUND" });
    return;
  }

  // Nunca devolver smtp_pass en claro; indicamos solo si está configurado
  const { smtp_pass, ...safeClinic } = clinic;
  res.json({ ...safeClinic, smtp_configured: !!smtp_pass });
});

/** PATCH /clinic — actualiza configuración. Solo ADMIN */
clinicRouter.patch("/", async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Solo administradores pueden modificar la clínica", code: "FORBIDDEN" });
    return;
  }

  const parsed = clinicUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  // Si smtp_pass viene vacío, no sobreescribir (mantener la anterior)
  const data: Record<string, unknown> = { ...parsed.data };
  if (data.smtp_pass === "" || data.smtp_pass === null) {
    delete data.smtp_pass;
  } else if (typeof data.smtp_pass === "string" && data.smtp_pass.length > 0) {
    // Encrypt smtp_pass before storing (AES-256-GCM as per security spec §7.2)
    data.smtp_pass = encryptField(data.smtp_pass);
  }

  const updated = await prisma.clinic.update({
    where: { id: req.user!.clinic_id },
    data: data as Parameters<typeof prisma.clinic.update>[0]["data"],
  });

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "UPDATE_CLINIC_SETTINGS",
      resource_type: "Clinic",
      resource_id: req.user!.clinic_id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  const { smtp_pass: _sp, ...safeUpdated } = updated;
  res.json({ ...safeUpdated, smtp_configured: !!(updated as any).smtp_pass });
});

/** POST /clinic/smtp/test — prueba la config SMTP actual */
clinicRouter.post("/smtp/test", async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Solo administradores", code: "FORBIDDEN" });
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });
  if (!clinic?.smtp_host || !clinic?.smtp_user || !clinic?.smtp_pass) {
    res.status(400).json({ error: "SMTP no configurado. Guarda primero el host, usuario y contraseña SMTP.", code: "SMTP_NOT_CONFIGURED" });
    return;
  }

  // Decrypt the stored smtp_pass before using it
  let decryptedPass: string;
  try {
    decryptedPass = decryptField(clinic.smtp_pass);
  } catch {
    res.status(500).json({ error: "Error al descifrar la contraseña SMTP almacenada", code: "DECRYPT_ERROR" });
    return;
  }

  const nodemailer = await import("nodemailer");
  try {
    const transporter = nodemailer.default.createTransport({
      host: clinic.smtp_host,
      port: clinic.smtp_port ?? 587,
      secure: (clinic.smtp_port ?? 587) === 465,
      auth: { user: clinic.smtp_user, pass: decryptedPass },
    });
    await transporter.verify();
    res.json({ success: true, message: "Conexión SMTP verificada correctamente" });
  } catch (err: any) {
    logger.error("Error testing SMTP configuration", err instanceof Error ? err : new Error(String(err)));
    res.status(400).json({ error: `Error SMTP: ${err.message}`, code: "SMTP_ERROR" });
  }
});

/** POST /clinic/logo — Sube o reemplaza el logo de la clínica */
clinicRouter.post("/logo", upload.single("logo"), async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Solo administradores" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No se proporcionó ningún archivo" });
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });
  
  // Delete old logo if exists in Cloudinary
  if (clinic?.logo_url) {
    const publicId = extractPublicId(clinic.logo_url);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        logger.error("Error deleting old logo from Cloudinary", e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  // Upload new logo to Cloudinary
  let logoUrl = "";
  try {
    const result = await cloudinary.uploader.upload(req.file.path, {
      folder: "Podelyx-demo/images",
    });
    logoUrl = result.secure_url;
    // Remove local file
    fs.unlinkSync(req.file.path);
  } catch (e) {
    logger.error("Error uploading logo to Cloudinary", e instanceof Error ? e : new Error(String(e)));
    res.status(500).json({ error: "Error subiendo el logo a Cloudinary" });
    return;
  }

  const updated = await prisma.clinic.update({
    where: { id: req.user!.clinic_id },
    data: { logo_url: logoUrl },
  });

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "UPLOAD_CLINIC_LOGO",
      resource_type: "Clinic",
      resource_id: req.user!.clinic_id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json({ logo_url: updated.logo_url });
});

/** DELETE /clinic/logo — Elimina el logo de la clínica */
clinicRouter.delete("/logo", async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Solo administradores" });
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });

  if (clinic?.logo_url) {
    const publicId = extractPublicId(clinic.logo_url);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        logger.error("Error deleting logo from Cloudinary", e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  const updated = await prisma.clinic.update({
    where: { id: req.user!.clinic_id },
    data: { logo_url: null },
  });

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "DELETE_CLINIC_LOGO",
      resource_type: "Clinic",
      resource_id: req.user!.clinic_id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json({ message: "Logo eliminado", logo_url: null });
});
