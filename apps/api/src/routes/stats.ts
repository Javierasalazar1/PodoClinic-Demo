import { Router, Request, Response } from "express";
import prisma from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export const statsRouter = Router();
statsRouter.use(authenticate);

/** GET /stats/dashboard */
statsRouter.get("/dashboard", async (req: Request, res: Response) => {
  const clinicId = req.user!.clinic_id;
  const isAdmin = req.user!.role === "ADMIN";
  const specialistFilter = isAdmin ? {} : { specialist_id: req.user!.sub };

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalPatients, totalConsultations, consultationsThisMonth, recent] =
    await Promise.all([
      prisma.patient.count({ where: { clinic_id: clinicId } }),
      prisma.consultation.count({ where: { clinic_id: clinicId, ...specialistFilter } }),
      prisma.consultation.count({
        where: {
          clinic_id: clinicId,
          ...specialistFilter,
          consultation_date: { gte: startOfMonth },
        },
      }),
      prisma.consultation.findMany({
        where: { clinic_id: clinicId, ...specialistFilter },
        orderBy: { consultation_date: "desc" },
        take: 8,
        include: { patient: { select: { full_name: true } } },
      }),
    ]);

  res.json({
    totalPatients,
    totalConsultations,
    consultationsThisMonth,
    recentConsultations: recent.map((c) => ({
      id: c.id,
      patient_name: c.patient.full_name,
      consultation_date: c.consultation_date,
      status: c.status,
      consultation_type: c.consultation_type,
    })),
  });
});
