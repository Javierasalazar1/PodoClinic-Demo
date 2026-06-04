import { Router, Request, Response } from "express";
import { z } from "zod";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export const patientsRouter = Router();
patientsRouter.use(authenticate);

const patientSchema = z.object({
  // Acepta cualquier identificación (RUT chileno, pasaporte, cédula, etc.)
  national_id: z.string().min(1, "Identificación obligatoria"),
  full_name: z.string().min(2),
  date_of_birth: z.string().min(1),
  biological_sex: z.enum(["MALE", "FEMALE", "OTHER"]),
  gender: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
});

/** GET /patients */
patientsRouter.get("/", async (req: Request, res: Response) => {
  const { search = "", page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {
    clinic_id: req.user!.clinic_id,
    archived_at: null,
    OR: search
      ? [
          { full_name: { contains: search, mode: "insensitive" as const } },
          { national_id: { contains: search } },
        ]
      : undefined,
  };
  const [data, total] = await Promise.all([
    prisma.patient.findMany({ where, skip, take: parseInt(limit), orderBy: { full_name: "asc" } }),
    prisma.patient.count({ where }),
  ]);
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

/** POST /patients */
patientsRouter.post("/", async (req: Request, res: Response) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }
  const data = parsed.data;
  const patient = await prisma.patient.create({
    data: {
      ...data,
      email: data.email || null,
      clinic_id: req.user!.clinic_id,
      date_of_birth: new Date(data.date_of_birth),
    },
  });
  res.status(201).json(patient);
});

/** GET /patients/archived (ADMIN ONLY) */
patientsRouter.get("/archived", async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Acceso denegado", code: "FORBIDDEN" });
    return;
  }
  const { search = "", page = "1", limit = "20" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);
  const where = {
    clinic_id: req.user!.clinic_id,
    archived_at: { not: null },
    OR: search
      ? [
          { full_name: { contains: search, mode: "insensitive" as const } },
          { national_id: { contains: search } },
        ]
      : undefined,
  };
  const [data, total] = await Promise.all([
    prisma.patient.findMany({ where, skip, take: parseInt(limit), orderBy: { full_name: "asc" } }),
    prisma.patient.count({ where }),
  ]);
  res.json({ data, total, page: parseInt(page), limit: parseInt(limit) });
});

/** GET /patients/:id */
patientsRouter.get("/:id", async (req: Request, res: Response) => {
  const patient = await prisma.patient.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id },
  });
  if (!patient) { res.status(404).json({ error: "Paciente no encontrado", code: "NOT_FOUND" }); return; }
  res.json(patient);
});

/** PATCH /patients/:id */
patientsRouter.patch("/:id", async (req: Request, res: Response) => {
  const patient = await prisma.patient.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id },
  });
  if (!patient) { res.status(404).json({ error: "Paciente no encontrado", code: "NOT_FOUND" }); return; }

  const parsed = patientSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: parsed.error.flatten() });
    return;
  }
  const updated = await prisma.patient.update({
    where: { id: req.params.id as string },
    data: {
      ...parsed.data,
      date_of_birth: parsed.data.date_of_birth ? new Date(parsed.data.date_of_birth) : undefined,
      email: parsed.data.email || null,
    },
  });
  res.json(updated);
});

/** PATCH /patients/:id/archive (ADMIN ONLY) */
patientsRouter.patch("/:id/archive", async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Acceso denegado", code: "FORBIDDEN" });
    return;
  }
  const patient = await prisma.patient.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id },
  });
  if (!patient) { res.status(404).json({ error: "Paciente no encontrado", code: "NOT_FOUND" }); return; }

  await prisma.$transaction([
    prisma.patient.update({
      where: { id: patient.id },
      data: { archived_at: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        user_id: req.user!.sub,
        clinic_id: req.user!.clinic_id,
        action: "ARCHIVE_PATIENT",
        resource_type: "Patient",
        resource_id: patient.id,
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    }),
  ]);
  res.json({ message: "Paciente archivado correctamente" });
});

/** PATCH /patients/:id/unarchive (ADMIN ONLY) */
patientsRouter.patch("/:id/unarchive", async (req: Request, res: Response) => {
  if (req.user!.role !== "ADMIN") {
    res.status(403).json({ error: "Acceso denegado", code: "FORBIDDEN" });
    return;
  }
  const patient = await prisma.patient.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id },
  });
  if (!patient) { res.status(404).json({ error: "Paciente no encontrado", code: "NOT_FOUND" }); return; }

  await prisma.$transaction([
    prisma.patient.update({
      where: { id: patient.id },
      data: { archived_at: null },
    }),
    prisma.auditLog.create({
      data: {
        user_id: req.user!.sub,
        clinic_id: req.user!.clinic_id,
        action: "UNARCHIVE_PATIENT",
        resource_type: "Patient",
        resource_id: patient.id,
        ip_address: req.ip ?? "",
        user_agent: req.headers["user-agent"] ?? "",
      },
    }),
  ]);
  res.json({ message: "Paciente restaurado correctamente" });
});

/** GET /patients/:id/consultations */
patientsRouter.get("/:id/consultations", async (req: Request, res: Response) => {
  const patient = await prisma.patient.findFirst({
    where: { id: req.params.id as string, clinic_id: req.user!.clinic_id },
  });
  if (!patient) { res.status(404).json({ error: "Paciente no encontrado", code: "NOT_FOUND" }); return; }

  const where =
    req.user!.role === "ADMIN"
      ? { patient_id: req.params.id as string, clinic_id: req.user!.clinic_id }
      : { patient_id: req.params.id as string, clinic_id: req.user!.clinic_id, specialist_id: req.user!.sub };

  const consultations = await prisma.consultation.findMany({
    where,
    orderBy: { consultation_date: "desc" },
    select: {
      id: true,
      consultation_date: true,
      consultation_type: true,
      status: true,
      chief_complaint: true,
    },
  });
  res.json(consultations);
});
