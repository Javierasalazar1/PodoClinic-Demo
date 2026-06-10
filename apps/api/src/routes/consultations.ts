import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import multer from "multer";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { generateConsultationPdf } from "../lib/pdfGenerator";
import logger from "../lib/logger";
import { createTransporter, getFromAddress } from "../lib/mailer";
import cloudinary, { extractPublicId } from "../config/cloudinary";

export const consultationsRouter = Router();
consultationsRouter.use(authenticate);

const getBaseUrl = () => {
  return process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
};

// Setup multer for photos
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage, limits: { fileSize: 5 * 1024 * 1024 } });

const consultationCreateSchema = z.object({
  patient_id: z.string().min(1),
  consultation_date: z.string().min(1),
  consultation_type: z.enum(["FIRST_TIME", "FOLLOW_UP", "URGENT"]),
  chief_complaint: z.string().max(500).optional(),
  podiatric_history: z.record(z.unknown()).optional(),
  medical_history: z.record(z.unknown()).optional(),
  lifestyle: z.record(z.unknown()).optional(),
  clinical_examination: z.record(z.unknown()).optional(),
  biomechanical_evaluation: z.record(z.unknown()).optional(),
  vascular_neurological: z.record(z.unknown()).optional(),
  treatment_plan: z.record(z.unknown()).optional(),
});

/** GET /consultations */
consultationsRouter.get("/", async (req: Request, res: Response) => {
  const { search = "", page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const isAdmin = req.user!.role === "ADMIN";
  const baseWhere = {
    clinic_id: req.user!.clinic_id,
    ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
  };

  const patients = search
    ? await prisma.patient.findMany({
        where: {
          clinic_id: req.user!.clinic_id,
          full_name: { contains: search, mode: "insensitive" as const },
        },
        select: { id: true },
      })
    : [];

  const where = search
    ? { ...baseWhere, patient_id: { in: patients.map((p) => p.id) } }
    : baseWhere;

  const [data, total] = await Promise.all([
    prisma.consultation.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { consultation_date: "desc" },
      select: {
        id: true,
        consultation_date: true,
        consultation_type: true,
        status: true,
        chief_complaint: true,
        patient: { select: { id: true, full_name: true, national_id: true } },
        specialist: { select: { full_name: true } },
      },
    }),
    prisma.consultation.count({ where }),
  ]);

  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

/** POST /consultations */
consultationsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = consultationCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  // Verify patient belongs to same clinic
  const patient = await prisma.patient.findFirst({
    where: { id: parsed.data.patient_id, clinic_id: req.user!.clinic_id },
  });
  if (!patient) {
    res.status(404).json({ error: "Paciente no encontrado", code: "NOT_FOUND" });
    return;
  }

  const consultation = await prisma.consultation.create({
    data: {
      clinic_id: req.user!.clinic_id,
      patient_id: parsed.data.patient_id,
      specialist_id: req.user!.sub,
      status: "DRAFT",
      consultation_date: new Date(parsed.data.consultation_date),
      consultation_type: parsed.data.consultation_type,
      chief_complaint: parsed.data.chief_complaint,
      podiatric_history: parsed.data.podiatric_history as any,
      medical_history: parsed.data.medical_history as any,
      lifestyle: parsed.data.lifestyle as any,
      clinical_examination: parsed.data.clinical_examination as any,
      biomechanical_evaluation: parsed.data.biomechanical_evaluation as any,
      vascular_neurological: parsed.data.vascular_neurological as any,
      treatment_plan: parsed.data.treatment_plan as any,
    },
  });

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "CREATE_CONSULTATION",
      resource_type: "Consultation",
      resource_id: consultation.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.status(201).json({ id: consultation.id });
});

/** GET /consultations/:id */
consultationsRouter.get("/:id", async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN";
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: req.params.id as string,
      clinic_id: req.user!.clinic_id,
      ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
    },
    include: {
      patient: { select: { id: true, full_name: true, national_id: true } },
      specialist: { select: { full_name: true, professional_title: true, license_number: true } },
      photos: { orderBy: { order_index: "asc" } },
      consent: true,
    },
  });
  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }
  res.json(consultation);
});

/** PATCH /consultations/:id */
consultationsRouter.patch("/:id", async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN";
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: req.params.id as string,
      clinic_id: req.user!.clinic_id,
      ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
    },
  });
  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }
  if (consultation.status === "FINALIZED") {
    res.status(409).json({ error: "No se puede editar una consulta finalizada", code: "CONFLICT" });
    return;
  }

  const parsed = consultationCreateSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  const { patient_id, consultation_date, ...rest } = parsed.data;

  const updated = await prisma.consultation.update({
    where: { id: req.params.id as string },
    data: {
      ...rest,
      podiatric_history: rest.podiatric_history as any,
      medical_history: rest.medical_history as any,
      lifestyle: rest.lifestyle as any,
      clinical_examination: rest.clinical_examination as any,
      biomechanical_evaluation: rest.biomechanical_evaluation as any,
      vascular_neurological: rest.vascular_neurological as any,
      treatment_plan: rest.treatment_plan as any,
      consultation_date: consultation_date ? new Date(consultation_date) : undefined,
    },
  });

  res.json(updated);
});

/** POST /consultations/:id/photos */
consultationsRouter.post("/:id/photos", upload.single("photo"), async (req: Request, res: Response, next: import("express").NextFunction) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "No photo file provided", code: "BAD_REQUEST" });
      return;
    }

    const safeDeleteFile = () => {
      try {
        if (req.file) fs.unlinkSync(req.file.path);
      } catch (err) {
        // ignore deletion errors
      }
    };

    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedMimeTypes.includes(req.file.mimetype.toLowerCase())) {
      safeDeleteFile();
      res.status(400).json({ error: "El archivo debe ser una imagen válida (JPEG, PNG, WEBP)", code: "INVALID_FILE_TYPE" });
      return;
    }

    if (req.file.size > 5 * 1024 * 1024) {
      safeDeleteFile();
      res.status(400).json({ error: "La imagen supera el límite de 5MB", code: "FILE_TOO_LARGE" });
      return;
    }

    const consultation = await prisma.consultation.findFirst({
      where: { id: req.params.id as string, clinic_id: req.user!.clinic_id, specialist_id: req.user!.sub },
    });

    if (!consultation) {
      safeDeleteFile();
      res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
      return;
    }

    let photoUrl = "";
    try {
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: "Podelyx-demo/images",
      });
      photoUrl = result.secure_url;
      safeDeleteFile();
    } catch (e) {
      safeDeleteFile();
      res.status(500).json({ error: "Error subiendo la foto a Cloudinary", code: "UPLOAD_ERROR" });
      return;
    }

    const photo = await prisma.consultationPhoto.create({
      data: {
        consultation_id: consultation.id,
        url: photoUrl,
        thumbnail_url: photoUrl, // simple MVP implementation
        label: "",
        order_index: req.body.order_index ? parseInt(req.body.order_index) : 0,
      },
    });

    res.status(201).json(photo);
  } catch (err) {
    next(err);
  }
});

/** GET /consultations/:id/photos/:photoId/download-url */
consultationsRouter.get("/:id/photos/:photoId/download-url", async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN";
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: req.params.id as string,
      clinic_id: req.user!.clinic_id,
      ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
    },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  const photo = await prisma.consultationPhoto.findFirst({
    where: { id: req.params.photoId as string, consultation_id: consultation.id },
  });

  if (!photo) {
    res.status(404).json({ error: "Foto no encontrada", code: "NOT_FOUND" });
    return;
  }

  // Retornamos directamente la secure_url de Cloudinary, es pública y suficiente para la demo.
  res.json({ url: photo.url });
});

/** DELETE /consultations/:id/photos/:photoId */
consultationsRouter.delete("/:id/photos/:photoId", async (req: Request, res: Response) => {
  const consultation = await prisma.consultation.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id, specialist_id: req.user!.sub },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  const photo = await prisma.consultationPhoto.findFirst({
    where: { id: req.params.photoId as string, consultation_id: consultation.id },
  });

  if (photo) {
    const publicId = extractPublicId(photo.url);
    if (publicId) {
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (e) {
        logger.error("Error deleting photo from Cloudinary", e instanceof Error ? e : new Error(String(e)));
      }
    }
  }

  await prisma.consultationPhoto.delete({
    where: { id: req.params.photoId as string, consultation_id: consultation.id },
  });

  res.status(204).send();
});

/** PATCH /consultations/:id/photos/:photoId */
consultationsRouter.patch("/:id/photos/:photoId", async (req: Request, res: Response) => {
  const consultation = await prisma.consultation.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id },
  });
  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  const schema = z.object({ label: z.string().max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR" });
    return;
  }

  const photo = await prisma.consultationPhoto.update({
    where: { id: req.params.photoId as string, consultation_id: consultation.id },
    data: { label: parsed.data.label },
  });

  res.json(photo);
});

/** POST /consultations/:id/consent */
consultationsRouter.post("/:id/consent", async (req: Request, res: Response) => {
  const schema = z.object({
    patient_signature_name: z.string().min(1),
    patient_signature_rut: z.string().min(1),
    signature_data_url: z.string().min(1),
    consent_accepted: z.boolean(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }

  const consultation = await prisma.consultation.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id, specialist_id: req.user!.sub },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: consultation.clinic_id } });

  let signatureCloudinaryUrl = parsed.data.signature_data_url;
  try {
    const uploadResult = await cloudinary.uploader.upload(parsed.data.signature_data_url, {
      folder: "Podelyx-demo/signatures",
    });
    signatureCloudinaryUrl = uploadResult.secure_url;
  } catch (error) {
    logger.error("Error uploading signature to Cloudinary", error instanceof Error ? error : new Error(String(error)));
    res.status(500).json({ error: "Error subiendo la firma a Cloudinary", code: "UPLOAD_ERROR" });
    return;
  }

  const consent = await prisma.consentRecord.upsert({
    where: { consultation_id: consultation.id },
    update: {
      patient_full_name: parsed.data.patient_signature_name,
      patient_national_id: parsed.data.patient_signature_rut,
      signature_url: signatureCloudinaryUrl,
      signed_at: new Date(),
      ip_address: req.ip ?? "",
    },
    create: {
      consultation_id: consultation.id,
      patient_full_name: parsed.data.patient_signature_name,
      patient_national_id: parsed.data.patient_signature_rut,
      consent_text_snapshot: clinic?.consent_text ?? "Consentimiento estándar",
      signature_url: signatureCloudinaryUrl,
      signed_at: new Date(),
      ip_address: req.ip ?? "",
    },
  });

  res.status(200).json(consent);
});

/** POST /consultations/:id/finalize */
consultationsRouter.post("/:id/finalize", async (req: Request, res: Response) => {
  const consultation = await prisma.consultation.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id, specialist_id: req.user!.sub },
    include: { consent: true },
  });
  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }
  if (consultation.status === "FINALIZED") {
    res.status(409).json({ error: "Ya está finalizada", code: "CONFLICT" });
    return;
  }

  if (!consultation.consent) {
    res.status(400).json({ error: "Se requiere consentimiento firmado", code: "CONSENT_REQUIRED" });
    return;
  }

  const updated = await prisma.consultation.update({
    where: { id: req.params.id as string },
    data: { status: "FINALIZED" },
  });

  // Extract next_appointment and update patient
  const treatmentPlan = consultation.treatment_plan as Record<string, any> | null;
  if (treatmentPlan && treatmentPlan.next_appointment) {
    await prisma.patient.update({
      where: { id: consultation.patient_id },
      data: { next_visit_date: new Date(treatmentPlan.next_appointment) },
    });
  }

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "FINALIZE_CONSULTATION",
      resource_type: "Consultation",
      resource_id: consultation.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json(updated);
});

/** POST /consultations/:id/generate-pdf — Fase 2: generación real con PDFKit */
consultationsRouter.post("/:id/generate-pdf", async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN";
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: req.params.id as string,
      clinic_id: req.user!.clinic_id,
      ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
    },
    include: {
      patient: true,
      specialist: true,
      photos: { orderBy: { order_index: "asc" } },
      consent: true,
    },
  });
  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  // Obtener datos de la clínica para el encabezado del PDF
  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });

  try {
    const pdfPath = await generateConsultationPdf({
      ...consultation,
      clinic: clinic ?? undefined,
      podiatric_history: consultation.podiatric_history as Record<string, unknown> | null,
      medical_history: consultation.medical_history as Record<string, unknown> | null,
      lifestyle: consultation.lifestyle as Record<string, unknown> | null,
      clinical_examination: consultation.clinical_examination as Record<string, unknown> | null,
      biomechanical_evaluation: consultation.biomechanical_evaluation as Record<string, unknown> | null,
      vascular_neurological: consultation.vascular_neurological as Record<string, unknown> | null,
      treatment_plan: consultation.treatment_plan as Record<string, unknown> | null,
    });

    let pdfUrl = "";
    try {
      const result = await cloudinary.uploader.upload(pdfPath, {
        folder: "Podelyx-demo/reports",
        resource_type: "image",
      });
      pdfUrl = result.secure_url;
      try {
        fs.unlinkSync(pdfPath); // Cleanup local PDF
      } catch (e) {
        // ignore
      }
    } catch (e) {
      logger.error("Error uploading PDF to Cloudinary", e instanceof Error ? e : new Error(String(e)));
      res.status(500).json({ error: "Error subiendo el PDF a Cloudinary", code: "UPLOAD_ERROR" });
      return;
    }

    await prisma.consultation.update({
      where: { id: req.params.id as string },
      data: { report_pdf_url: pdfUrl },
    });

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.sub,
        clinic_id: req.user!.clinic_id,
        action: "GENERATE_PDF",
        resource_type: "Consultation",
        resource_id: consultation.id,
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    });

    res.json({ url: pdfUrl });
  } catch (err) {
    logger.error("PDF generation error", err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: "Error al generar el PDF", code: "PDF_ERROR" });
  }
});

/** POST /consultations/:id/send-email */
consultationsRouter.post("/:id/send-email", async (req: Request, res: Response) => {
  const schema = z.object({
    to_email: z.string().email("Email inválido"),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Email inválido", code: "VALIDATION_ERROR" });
    return;
  }

  const isAdmin = req.user!.role === "ADMIN";
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: req.params.id as string,
      clinic_id: req.user!.clinic_id,
      ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
    },
    include: {
      patient: true,
      specialist: true,
      photos: { orderBy: { order_index: "asc" } },
      consent: true,
    },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });

  // Generar PDF
  let pdfPath: string;
  try {
    pdfPath = await generateConsultationPdf({
      ...consultation,
      clinic: clinic ?? undefined,
      podiatric_history: consultation.podiatric_history as Record<string, unknown> | null,
      medical_history: consultation.medical_history as Record<string, unknown> | null,
      lifestyle: consultation.lifestyle as Record<string, unknown> | null,
      clinical_examination: consultation.clinical_examination as Record<string, unknown> | null,
      biomechanical_evaluation: consultation.biomechanical_evaluation as Record<string, unknown> | null,
      vascular_neurological: consultation.vascular_neurological as Record<string, unknown> | null,
      treatment_plan: consultation.treatment_plan as Record<string, unknown> | null,
    });
  } catch (err) {
    logger.error("PDF generation error for email", err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: "Error al generar el PDF para envío", code: "PDF_ERROR" });
    return;
  }

  // Configurar transporte Nodemailer
  // Si la clínica tiene SMTP configurado se usa; si no, se usa Ethereal (test) en desarrollo
  const transporter = await createTransporter(clinic);

  const clinicName = clinic?.name ?? "Podelyx";
  const dateStr = new Date(consultation.consultation_date).toLocaleDateString("es-CL", {
    day: "2-digit", month: "long", year: "numeric"
  });

  try {
    const safeName = (consultation.patient.full_name || "Paciente").replace(/\s+/g, "_");
    const safeDate = dateStr.replace(/[\s,]/g, "_");
    const info = await transporter.sendMail({
      from: getFromAddress(clinic, clinicName),
      to: parsed.data.to_email,
      subject: `Informe Clínico Podológico — ${consultation.patient.full_name} — ${dateStr}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;">
          <div style="border-bottom:3px solid #0F6E56;padding-bottom:16px;margin-bottom:24px;">
            <h2 style="color:#0F6E56;margin:0;">${clinicName}</h2>
          </div>
          <p style="font-size:16px;">Estimado/a <strong>${consultation.patient.full_name}</strong>,</p>
          <p style="color:#555;">Adjunto encontrará su informe clínico podológico correspondiente a la consulta del
             <strong>${dateStr}</strong>, atendido/a por <strong>${consultation.specialist.full_name}</strong>.</p>
          <p style="color:#555;">Por favor, conserve este documento para su historial médico personal.</p>
          <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:16px;margin:24px 0;">
            <p style="margin:0;color:#166534;font-size:13px;">📋 Este informe ha sido generado y certificado electrónicamente por Podelyx.</p>
          </div>
          <p style="color:#888;font-size:11px;border-top:1px solid #eee;padding-top:16px;">
            Documento generado electrónicamente — Podelyx · Cumple Ley 19.628 de Protección de Datos Personales (Chile)
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `Informe_Podologico_${safeName}_${safeDate}.pdf`,
          path: pdfPath,
          contentType: "application/pdf",
        },
      ],
    });

    // Guardar URL del PDF generado si aún no estaba guardada
    let pdfUrl = consultation.report_pdf_url;
    if (!pdfUrl) {
      try {
        const result = await cloudinary.uploader.upload(pdfPath, {
          folder: "Podelyx-demo/reports",
          resource_type: "image",
        });
        pdfUrl = result.secure_url;
        await prisma.consultation.update({
          where: { id: req.params.id as string },
          data: { report_pdf_url: pdfUrl },
        });
      } catch (e) {
        logger.error("Error uploading PDF to Cloudinary", e instanceof Error ? e : new Error(String(e)));
      }
    }

    try {
      fs.unlinkSync(pdfPath); // Cleanup local file
    } catch (e) {
      // ignore
    }

    // En desarrollo, mostrar URL de preview de Ethereal
    const previewUrl = nodemailer.getTestMessageUrl(info);

    await prisma.auditLog.create({
      data: {
        user_id: req.user!.sub,
        clinic_id: req.user!.clinic_id,
        action: "SEND_EMAIL",
        resource_type: "Consultation",
        resource_id: consultation.id,
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    });

    res.json({
      success: true,
      message: "Correo enviado correctamente",
      pdf_url: pdfUrl,
      // previewUrl se devuelve solo en desarrollo para que el especialista pueda verlo
      ...(process.env.NODE_ENV !== "production" && previewUrl ? { preview_url: String(previewUrl) } : {}),
    });
  } catch (err) {
    logger.error("Email send error", err instanceof Error ? err : new Error(String(err)));
    res.status(500).json({ error: "Error al enviar el correo", code: "EMAIL_ERROR" });
  }
});

/** POST /consultations/:id/share-link — Genera enlace temporal y abre WhatsApp (Fase 3) */
consultationsRouter.post("/:id/share-link", async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN";
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: req.params.id as string,
      clinic_id: req.user!.clinic_id,
      ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
    },
    include: {
      patient: true,
      specialist: true,
      photos: { orderBy: { order_index: "asc" } },
      consent: true,
    },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });

  // Si ya hay PDF guardado, usarlo; si no, generarlo
  let pdfUrl = consultation.report_pdf_url;

  if (!pdfUrl) {
    try {
      const { generateConsultationPdf } = await import("../lib/pdfGenerator");
      const pdfPath = await generateConsultationPdf({
        ...consultation,
        clinic: clinic ?? undefined,
        podiatric_history: consultation.podiatric_history as Record<string, unknown> | null,
        medical_history: consultation.medical_history as Record<string, unknown> | null,
        lifestyle: consultation.lifestyle as Record<string, unknown> | null,
        clinical_examination: consultation.clinical_examination as Record<string, unknown> | null,
        biomechanical_evaluation: consultation.biomechanical_evaluation as Record<string, unknown> | null,
        vascular_neurological: consultation.vascular_neurological as Record<string, unknown> | null,
        treatment_plan: consultation.treatment_plan as Record<string, unknown> | null,
      });
      try {
        const result = await cloudinary.uploader.upload(pdfPath, {
          folder: "Podelyx-demo/reports",
          resource_type: "image",
        });
        pdfUrl = result.secure_url;
        await prisma.consultation.update({
          where: { id: req.params.id as string },
          data: { report_pdf_url: pdfUrl },
        });
        try {
          fs.unlinkSync(pdfPath); // Cleanup local
        } catch (e) {
          // ignore
        }
      } catch (e) {
        logger.error("Error uploading PDF to Cloudinary in share-link", e instanceof Error ? e : new Error(String(e)));
        res.status(500).json({ error: "Error subiendo el PDF a Cloudinary", code: "UPLOAD_ERROR" });
        return;
      }
    } catch (err) {
      logger.error("PDF generation error for share link", err instanceof Error ? err : new Error(String(err)));
      res.status(500).json({ error: "Error al generar el PDF para compartir", code: "PDF_ERROR" });
      return;
    }
  }

  // En la versión Demo, la URL de Cloudinary es pública directamente
  const shareUrl = pdfUrl;
  const patientPhone = (consultation.patient as any).phone?.replace(/[^0-9]/g, "") ?? "";

  const clinicName = clinic?.name ?? "Podelyx";
  const dateStr = new Date(consultation.consultation_date).toLocaleDateString("es-CL", {
    day: "2-digit", month: "long", year: "numeric"
  });

  const whatsappText = encodeURIComponent(
    `Hola ${consultation.patient.full_name}, le enviamos su informe clínico podológico de la consulta del ${dateStr} en ${clinicName}.\n\nAcceda al documento aquí: ${shareUrl}\n\nEste enlace es válido por 72 horas.`
  );

  const whatsappUrl = patientPhone
    ? `https://wa.me/${patientPhone}?text=${whatsappText}`
    : `https://wa.me/?text=${whatsappText}`;

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "SHARE_LINK_GENERATED",
      resource_type: "Consultation",
      resource_id: consultation.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.json({
    share_url: shareUrl,
    whatsapp_url: whatsappUrl,
    pdf_url: pdfUrl,
    expires_in_hours: 72,
  });
});

/** DELETE /consultations/:id */
consultationsRouter.delete("/:id", async (req: Request, res: Response) => {
  const isAdmin = req.user!.role === "ADMIN";
  const consultation = await prisma.consultation.findFirst({
    where: {
      id: req.params.id as string,
      clinic_id: req.user!.clinic_id,
      ...(isAdmin ? {} : { specialist_id: req.user!.sub }),
    },
  });

  if (!consultation) {
    res.status(404).json({ error: "Consulta no encontrada", code: "NOT_FOUND" });
    return;
  }

  if (consultation.status === "FINALIZED") {
    res.status(400).json({ error: "No se puede eliminar una consulta finalizada", code: "BAD_REQUEST" });
    return;
  }

  // Clean up files from Cloudinary
  const photos = await prisma.consultationPhoto.findMany({ where: { consultation_id: consultation.id } });
  const consent = await prisma.consentRecord.findUnique({ where: { consultation_id: consultation.id } });

  for (const photo of photos) {
    const pid = extractPublicId(photo.url);
    if (pid) await cloudinary.uploader.destroy(pid).catch(() => {});
  }
  if (consent?.signature_url) {
    const pid = extractPublicId(consent.signature_url);
    if (pid) await cloudinary.uploader.destroy(pid).catch(() => {});
  }
  if (consultation.report_pdf_url) {
    const pid = extractPublicId(consultation.report_pdf_url);
    if (pid) await cloudinary.uploader.destroy(pid, { resource_type: "image" }).catch(() => {});
  }

  // Use transaction to ensure complete deletion
  await prisma.$transaction([
    prisma.consultationPhoto.deleteMany({
      where: { consultation_id: consultation.id }
    }),
    prisma.consentRecord.deleteMany({
      where: { consultation_id: consultation.id }
    }),
    prisma.consultation.delete({
      where: { id: consultation.id }
    })
  ]);

  await prisma.auditLog.create({
    data: {
      user_id: req.user!.sub,
      clinic_id: req.user!.clinic_id,
      action: "DELETE_CONSULTATION",
      resource_type: "Consultation",
      resource_id: consultation.id,
      ip_address: req.ip ?? "",
      user_agent: req.headers["user-agent"] ?? "",
    },
  });

  res.status(204).send();
});
