import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";
import * as nodemailer from "nodemailer";
import { createTransporter, getFromAddress } from "../lib/mailer";

export const remindersRouter = Router();
remindersRouter.use(authenticate);

remindersRouter.get("/", async (req: Request, res: Response) => {
  const { range = "7" } = req.query as Record<string, string>;
  const days = parseInt(range);
  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const isAdmin = req.user!.role === "ADMIN";
  const isReception = req.user!.role === "RECEPTION";
  const where: any = {
    clinic_id: req.user!.clinic_id,
    archived_at: null,
    next_visit_date: {
      gte: now,
      lte: endDate,
    },
  };

  if (!isAdmin && !isReception) {
    where.consultations = {
      some: { specialist_id: req.user!.sub }
    };
  }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      consultations: {
        orderBy: { consultation_date: 'desc' },
        take: 1,
        include: { specialist: true }
      }
    },
    orderBy: { next_visit_date: "asc" }
  });

  const filtered = patients.filter((p) => {
    const futureConsultations = p.consultations.filter(c => new Date(c.consultation_date) >= new Date(p.next_visit_date!));
    return futureConsultations.length === 0;
  });

  res.json(filtered.map(p => ({
    id: p.id,
    full_name: p.full_name,
    phone: p.phone,
    email: p.email,
    next_visit_date: p.next_visit_date,
    last_reminder_sent_at: p.last_reminder_sent_at,
    last_specialist: p.consultations[0]?.specialist?.full_name || "Sin especialista",
  })));
});

remindersRouter.get("/overdue", async (req: Request, res: Response) => {
  const now = new Date();
  
  const isAdmin = req.user!.role === "ADMIN";
  const isReception = req.user!.role === "RECEPTION";
  const where: any = {
    clinic_id: req.user!.clinic_id,
    archived_at: null,
    next_visit_date: {
      lt: now,
    },
  };

  if (!isAdmin && !isReception) {
    where.consultations = {
      some: { specialist_id: req.user!.sub }
    };
  }

  const patients = await prisma.patient.findMany({
    where,
    include: {
      consultations: {
        orderBy: { consultation_date: 'desc' },
        take: 1,
        include: { specialist: true }
      }
    },
    orderBy: { next_visit_date: "desc" }
  });

  const filtered = patients.filter((p) => {
    const futureConsultations = p.consultations.filter(c => new Date(c.consultation_date) >= new Date(p.next_visit_date!));
    return futureConsultations.length === 0;
  });

  res.json(filtered.map(p => ({
    id: p.id,
    full_name: p.full_name,
    phone: p.phone,
    email: p.email,
    next_visit_date: p.next_visit_date,
    last_reminder_sent_at: p.last_reminder_sent_at,
    last_specialist: p.consultations[0]?.specialist?.full_name || "Sin especialista",
  })));
});

remindersRouter.post("/:patientId/send-whatsapp", async (req: Request, res: Response) => {
  const schema = z.object({
    message: z.string().min(1, "El mensaje es requerido").max(1000, "El mensaje no puede superar 1000 caracteres"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }
  const { message } = parsed.data;

  const patient = await prisma.patient.findUnique({ where: { id: req.params.patientId as string } });
  if (!patient || patient.clinic_id !== req.user!.clinic_id) { res.status(404).json({ error: "Patient not found" }); return; }

  await prisma.$transaction([
    prisma.patient.update({
      where: { id: patient.id },
      data: { last_reminder_sent_at: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        user_id: req.user!.sub,
        clinic_id: req.user!.clinic_id,
        action: "SEND_WHATSAPP_REMINDER",
        resource_type: "Patient",
        resource_id: patient.id,
        ip_address: req.ip ?? "",
        user_agent: String(req.headers["user-agent"] || ""),
      },
    })
  ]);

  const phone = patient.phone?.replace(/[^0-9+]/g, "") || "";
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  res.json({ url });
});

remindersRouter.post("/:patientId/send-email", async (req: Request, res: Response) => {
  const schema = z.object({
    subject: z.string().min(1).max(200).optional(),
    message: z.string().min(1, "El mensaje es requerido").max(5000, "El mensaje no puede superar 5000 caracteres"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }
  const { subject, message } = parsed.data;
  
  const patient = await prisma.patient.findUnique({ where: { id: req.params.patientId as string } });
  if (!patient || patient.clinic_id !== req.user!.clinic_id) { res.status(404).json({ error: "Patient not found" }); return; }
  if (!patient.email) { res.status(400).json({ error: "Patient has no email" }); return; }

  const clinic = await prisma.clinic.findUnique({ where: { id: req.user!.clinic_id } });
  
  const transporter = await createTransporter(clinic);

  await transporter.sendMail({
    from: getFromAddress(clinic, clinic?.name || 'PodoClinic'),
    to: patient.email,
    subject: subject || "Recordatorio de cita",
    text: message,
  });

  await prisma.$transaction([
    prisma.patient.update({
      where: { id: patient.id },
      data: { last_reminder_sent_at: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        user_id: req.user!.sub,
        clinic_id: req.user!.clinic_id,
        action: "SEND_EMAIL_REMINDER",
        resource_type: "Patient",
        resource_id: patient.id,
        ip_address: req.ip ?? "",
        user_agent: String(req.headers["user-agent"] || ""),
      },
    })
  ]);

  res.json({ success: true });
});

remindersRouter.patch("/:patientId/mark-contacted", async (req: Request, res: Response) => {
  const patient = await prisma.patient.findUnique({ where: { id: req.params.patientId as string } });
  if (!patient || patient.clinic_id !== req.user!.clinic_id) { res.status(404).json({ error: "Patient not found" }); return; }

  await prisma.$transaction([
    prisma.patient.update({
      where: { id: patient.id },
      data: { last_reminder_sent_at: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        user_id: req.user!.sub,
        clinic_id: req.user!.clinic_id,
        action: "MARK_REMINDER_CONTACTED",
        resource_type: "Patient",
        resource_id: patient.id,
        ip_address: req.ip ?? "",
        user_agent: String(req.headers["user-agent"] || ""),
      },
    })
  ]);

  res.json({ success: true });
});
