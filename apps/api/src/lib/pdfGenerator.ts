import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import https from "https";
import http from "http";

/**
 * Descarga una imagen desde una URL local o remota y devuelve el buffer.
 * Se usa para embeber fotografías clínicas y firmas en el PDF.
 */
async function fetchImageBuffer(url: string): Promise<Buffer | null> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const lib = parsed.protocol === "https:" ? https : http;
      lib.get(url, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks)));
        res.on("error", () => resolve(null));
      }).on("error", () => resolve(null));
    } catch {
      // Ruta local absoluta
      try {
        if (fs.existsSync(url)) {
          resolve(fs.readFileSync(url));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    }
  });
}

// Diccionario de etiquetas en español para campos de las secciones JSON
const FIELD_LABELS: Record<string, string> = {
  prev_consultations: "Consultas previas",
  prev_consultations_desc: "Descripción",
  prev_pathologies: "Patologías previas",
  prev_pathologies_other: "Otras patologías",
  prev_treatments: "Tratamientos previos",
  prev_orthotics: "Uso de plantillas",
  systemic_diseases: "Enfermedades sistémicas",
  systemic_diseases_other: "Otras enf. sistémicas",
  allergies: "Alergias",
  current_medication: "Medicación actual",
  prev_foot_surgery: "Cirugía previa de pie",
  prev_foot_surgery_desc: "Descripción cirugía",
  current_pregnancy: "Embarazo actual",
  occupation: "Ocupación",
  physical_activity: "Actividad física",
  sport: "Deporte",
  footwear_types: "Tipos de calzado",
  hours_standing: "Horas de pie",
  dermatological_inspection: "Inspección dermatológica",
  nail_status: "Estado de uñas",
  skin_temperature_right: "Temp. cutánea (Der.)",
  skin_temperature_left: "Temp. cutánea (Izq.)",
  edema: "Edema",
  edema_desc: "Descripción edema",
  structural_deformities: "Deformidades estructurales",
  pressure_zones: "Zonas de presión",
  footprint_type_right: "Tipo pisada (Der.)",
  footprint_type_left: "Tipo pisada (Izq.)",
  beighton_score: "Índice de Beighton",
  jack_test: "Test de Jack",
  fick_angle: "Ángulo de Fick",
  leg_length: "Longitud miembros",
  leg_length_desc: "Descripción",
  calcaneal_angle: "Ángulo calcáneo",
  gait_observations: "Observaciones marcha",
  pedal_pulse_right: "Pulso pedio (Der.)",
  pedal_pulse_left: "Pulso pedio (Izq.)",
  tibial_pulse_right: "Pulso tibial (Der.)",
  tibial_pulse_left: "Pulso tibial (Izq.)",
  abi_index: "Índice tobillo-brazo",
  sensitivity_test_right: "Sensibilidad (Der.)",
  sensitivity_test_left: "Sensibilidad (Izq.)",
  vibratory_sensitivity: "Sensib. vibratoria",
  achilles_reflex: "Reflejo aquíleo",
  temperature_eval: "Eval. temperatura",
  vascular_obs: "Observaciones vasculares",
  diagnosis: "Diagnóstico",
  treatment_objectives: "Objetivos tratamiento",
  procedures: "Procedimientos",
  procedures_other: "Otros procedimientos",
  materials_used: "Materiales utilizados",
  next_session_plan: "Plan próxima sesión",
  referrals: "Derivaciones",
  next_appointment: "Próxima cita",
};

const VALUE_LABELS: Record<string, string> = {
  YES: "Sí", NO: "No", NA: "No aplica",
  SEDENTARY: "Sedentario", MODERATE: "Moderada", INTENSE: "Intensa",
  LT4: "Menos de 4h", "4TO8": "4 a 8h", GT8: "Más de 8h",
  NORMAL: "Normal", INCREASED: "Aumentada", DECREASED: "Disminuida",
  ABSENT: "Ausente", PRESENT: "Presente",
  SUPINATOR: "Supinadora", NEUTRAL: "Neutra", PRONATOR: "Pronadora",
  ALTERED: "Alterado", SYMMETRIC: "Simétrica", ASYMMETRIC: "Asimetría",
  FIRST_TIME: "Primera vez", FOLLOW_UP: "Seguimiento", URGENT: "Urgencia",
};

function formatValue(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (Array.isArray(v)) {
    return v.map((item) => VALUE_LABELS[String(item)] || String(item)).join(", ");
  }
  return VALUE_LABELS[String(v)] || String(v);
}

// Color primario corporativo
const PRIMARY = "#0F6E56";
const LIGHT_GRAY = "#F8F9FA";
const BORDER_GRAY = "#DEE2E6";

interface PdfConsultation {
  id: string;
  consultation_date: Date;
  consultation_type: string;
  chief_complaint?: string | null;
  podiatric_history?: Record<string, unknown> | null;
  medical_history?: Record<string, unknown> | null;
  lifestyle?: Record<string, unknown> | null;
  clinical_examination?: Record<string, unknown> | null;
  biomechanical_evaluation?: Record<string, unknown> | null;
  vascular_neurological?: Record<string, unknown> | null;
  treatment_plan?: Record<string, unknown> | null;
  patient: {
    full_name: string;
    national_id: string;
    date_of_birth?: Date | null;
    phone?: string | null;
    email?: string | null;
  };
  specialist: {
    full_name: string;
    professional_title?: string | null;
    license_number?: string | null;
  };
  photos?: { id: string; url: string; label?: string | null }[];
  consent?: {
    patient_full_name: string;
    patient_national_id: string;
    signature_url: string;
    signed_at: Date;
    ip_address?: string | null;
    consent_text_snapshot?: string | null;
  } | null;
  clinic?: {
    name: string;
    logo_url?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    registration_number?: string | null;
    primary_color?: string | null;
  } | null;
}

/**
 * Genera el PDF clínico completo y lo guarda en el directorio de uploads.
 * Devuelve la ruta absoluta del archivo generado.
 */
export async function generateConsultationPdf(consultation: PdfConsultation): Promise<string> {
  const fileName = `report-${consultation.id}-${Date.now()}.pdf`;
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, fileName);

  const accent = consultation.clinic?.primary_color ?? PRIMARY;

  const doc = new PDFDocument({
    size: "A4",
    bufferPages: true,
    margins: { top: 50, bottom: 50, left: 55, right: 55 },
    info: {
      Title: `Informe Clínico Podológico — ${consultation.patient.full_name}`,
      Author: consultation.specialist.full_name,
      Creator: "PodoClinic",
    },
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const pageW = doc.page.width;
  const margin = 55;
  const contentW = pageW - margin * 2;

  // ─── HEADER ──────────────────────────────────────────────────────────────
  const clinicName = consultation.clinic?.name ?? "PodoClinic";
  let hasLogo = false;

  if (consultation.clinic?.logo_url) {
    const logoBuffer = await fetchImageBuffer(consultation.clinic.logo_url);
    if (logoBuffer) {
      doc.image(logoBuffer, margin, 40, { height: 45, fit: [120, 45] });
      hasLogo = true;
    }
  }

  if (hasLogo) {
    doc.font("Helvetica-Bold").fontSize(11).fillColor(accent).text(clinicName, margin + 130, 42, { align: "right", width: contentW - 130 });
  } else {
    doc.font("Helvetica-Bold").fontSize(16).fillColor(accent).text(clinicName, margin, 42, { align: "left" });
    doc.y = 42; // reset Y to draw the right column properly
  }

  doc.font("Helvetica").fontSize(8).fillColor("#555555");
  if (consultation.clinic?.address) {
    doc.text(consultation.clinic.address, margin, doc.y, { align: "right", width: contentW });
  }
  if (consultation.clinic?.phone) {
    doc.text(`Tel: ${consultation.clinic.phone}`, margin, doc.y, { align: "right", width: contentW });
  }
  if (consultation.clinic?.registration_number) {
    doc.text(`Registro: ${consultation.clinic.registration_number}`, margin, doc.y, { align: "right", width: contentW });
  }

  doc.moveDown(1);
  doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).strokeColor(BORDER_GRAY).lineWidth(1).stroke();
  doc.moveDown(1.5);

  // ─── TÍTULO ──────────────────────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(20).fillColor(accent).text("INFORME CLÍNICO PODOLÓGICO", margin, doc.y, { align: "center", width: contentW });
  doc.moveDown(0.3);
  const consultaType = consultation.consultation_type ? VALUE_LABELS[consultation.consultation_type] || consultation.consultation_type : "";
  const dateStr = new Date(consultation.consultation_date).toLocaleDateString("es-CL", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  doc.font("Helvetica").fontSize(10).fillColor("#777777").text(
    `Consulta: ${consultaType} · ${dateStr}`,
    margin, doc.y, { align: "center", width: contentW }
  );
  doc.moveDown(1.5);

  // ─── DATOS ESPECIALISTA / PACIENTE ───────────────────────────────────────
  const colW = (contentW - 15) / 2;
  const startY = doc.y;

  doc.rect(margin, startY, colW, 85).fillColor(LIGHT_GRAY).fill();
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(8).text("ESPECIALISTA RESPONSABLE", margin + 12, startY + 12);
  doc.fillColor("#222222").font("Helvetica-Bold").fontSize(11).text(consultation.specialist.full_name, margin + 12, startY + 30);
  doc.fillColor("#555555").font("Helvetica").fontSize(9);
  if (consultation.specialist.professional_title) doc.text(consultation.specialist.professional_title, margin + 12, doc.y + 2);
  if (consultation.specialist.license_number) doc.text(`N° Reg.: ${consultation.specialist.license_number}`, margin + 12, doc.y + 2);

  const col2X = margin + colW + 15;
  doc.rect(col2X, startY, colW, 85).fillColor(LIGHT_GRAY).fill();
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(8).text("PACIENTE", col2X + 12, startY + 12);
  doc.fillColor("#222222").font("Helvetica-Bold").fontSize(11).text(consultation.patient.full_name, col2X + 12, startY + 30);
  doc.fillColor("#555555").font("Helvetica").fontSize(9);
  doc.text(`RUT: ${consultation.patient.national_id}`, col2X + 12, doc.y + 2);
  if (consultation.patient.date_of_birth) {
    const age = Math.floor((Date.now() - new Date(consultation.patient.date_of_birth).getTime()) / (365.25 * 24 * 3600 * 1000));
    doc.text(`Edad: ${age} años`, col2X + 12, doc.y + 1);
  }
  if (consultation.patient.phone) doc.text(`Tel: ${consultation.patient.phone}`, col2X + 12, doc.y + 1);
  if (consultation.patient.email) doc.text(`Email: ${consultation.patient.email}`, col2X + 12, doc.y + 1);

  doc.y = startY + 100;

  // ─── MOTIVO DE CONSULTA ──────────────────────────────────────────────────
  if (consultation.chief_complaint) {
    sectionTitle(doc, "MOTIVO DE CONSULTA", margin, accent, contentW);
    doc.x = margin;
    doc.font("Helvetica").fontSize(10).fillColor("#333333").text(consultation.chief_complaint, { width: contentW, align: "justify" });
    doc.moveDown(0.8);
  }

  // ─── SECCIONES CLÍNICAS ──────────────────────────────────────────────────
  const sections: [string, Record<string, unknown> | null | undefined][] = [
    ["ANTECEDENTES PODOLÓGICOS", consultation.podiatric_history],
    ["ANTECEDENTES MÉDICOS", consultation.medical_history],
    ["ESTILO DE VIDA", consultation.lifestyle],
    ["EXPLORACIÓN CLÍNICA", consultation.clinical_examination],
    ["EVALUACIÓN BIOMECÁNICA", consultation.biomechanical_evaluation],
    ["VASCULAR Y NEUROLÓGICO", consultation.vascular_neurological],
    ["PLAN DE TRATAMIENTO", consultation.treatment_plan],
  ];

  for (const [title, data] of sections) {
    if (!data || Object.keys(data).length === 0) continue;
    const entries = Object.entries(data).filter(([, v]) => {
      if (v === null || v === undefined || v === "") return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    });
    if (entries.length === 0) continue;

    sectionTitle(doc, title, margin, accent, contentW);

    for (const [k, v] of entries) {
      const formatted = formatValue(v);
      if (!formatted) continue;
      const label = FIELD_LABELS[k] || k.replace(/_/g, " ");

      // Evitar coordenadas absolutas para no romper el salto de línea
      doc.x = margin;
      doc.font("Helvetica-Bold").fontSize(9).fillColor("#444444").text(`${label}: `, { continued: true });
      doc.font("Helvetica").fontSize(9).fillColor("#111111").text(formatted);
      doc.moveDown(0.2);
    }
    doc.moveDown(0.8);
  }

  // ─── FOTOGRAFÍAS CLÍNICAS ────────────────────────────────────────────────
  if (consultation.photos && consultation.photos.length > 0) {
    sectionTitle(doc, "FOTOGRAFÍAS CLÍNICAS", margin, accent, contentW);

    const imgW = (contentW - 15) / 2;
    const imgH = 130;
    const neededSpace = imgH + 25;

    let col = 0;
    let rowY = doc.y;

    for (const photo of consultation.photos) {
      if (col === 0 && rowY + neededSpace > doc.page.height - 50) {
        doc.addPage();
        rowY = doc.y;
      }

      const x = col === 0 ? margin : margin + imgW + 15;

      try {
        const fileName = path.basename(photo.url);
        const absPath = path.join(process.cwd(), "uploads", fileName);
        if (fs.existsSync(absPath)) {
          doc.image(absPath, x, rowY, { width: imgW, height: imgH, fit: [imgW, imgH] });
        } else {
          throw new Error("No existe");
        }
      } catch {
        doc.rect(x, rowY, imgW, imgH).fillColor("#EEEEEE").fill();
        doc.fillColor("#AAAAAA").font("Helvetica").fontSize(8).text("Imagen no disponible", x, rowY + imgH / 2 - 4, { width: imgW, align: "center" });
      }

      const labelText = photo.label || "";
      doc.fillColor("#555555").font("Helvetica").fontSize(8).text(labelText, x, rowY + imgH + 5, { width: imgW, align: "center" });

      col++;
      if (col === 2) {
        col = 0;
        rowY += neededSpace + 10;
      }
    }

    if (col === 1) {
      rowY += neededSpace + 10;
    }
    if (rowY >= doc.page.height - 50) {
      doc.addPage();
    } else {
      doc.y = rowY;
      doc.moveDown(0.5);
    }
  }

  // ─── CONSENTIMIENTO INFORMADO ────────────────────────────────────────────
  if (consultation.consent) {
    if (doc.y + 150 > doc.page.height - 50) doc.addPage();
    sectionTitle(doc, "CONSENTIMIENTO INFORMADO", margin, accent, contentW);

    const consentText = consultation.consent.consent_text_snapshot || "Consentimiento estándar PodoClinic";
    doc.x = margin;
    doc.font("Helvetica").fontSize(9).fillColor("#555555").text(consentText, { align: "justify", width: contentW });
    doc.moveDown(1.5);

    let signatureY = doc.y;
    if (signatureY + 100 > doc.page.height - 50) {
      doc.addPage();
      signatureY = doc.y;
    }

    doc.font("Helvetica-Bold").fontSize(9).fillColor("#333333").text("DATOS DEL FIRMANTE", margin, signatureY);
    doc.font("Helvetica").fontSize(9).fillColor("#222222");
    doc.text(`Firmado por: ${consultation.consent.patient_full_name}`, margin, signatureY + 15);
    doc.text(`RUT / ID: ${consultation.consent.patient_national_id}`, margin, signatureY + 30);
    doc.text(`Fecha de firma: ${new Date(consultation.consent.signed_at).toLocaleString("es-CL")}`, margin, signatureY + 45);

    if (consultation.consent.signature_url) {
      try {
        let sigBuffer: Buffer | null = null;
        if (consultation.consent.signature_url.startsWith("data:image")) {
          const base64 = consultation.consent.signature_url.split(",")[1];
          sigBuffer = Buffer.from(base64, "base64");
        } else {
          sigBuffer = await fetchImageBuffer(consultation.consent.signature_url);
        }
        if (sigBuffer) {
          const sigX = margin + contentW - 160;
          doc.rect(sigX - 5, signatureY - 5, 165, 85).fillColor("#FAFAFA").fill();
          doc.rect(sigX - 5, signatureY - 5, 165, 85).strokeColor(BORDER_GRAY).lineWidth(0.5).stroke();
          doc.fillColor("#AAAAAA").font("Helvetica").fontSize(7).text("FIRMA DEL PACIENTE", sigX, signatureY, { width: 155, align: "center" });
          doc.image(sigBuffer, sigX, signatureY + 10, { width: 155, height: 65, fit: [155, 65] });
        }
      } catch { }
    }

    const finalY = signatureY + 90;
    if (finalY >= doc.page.height - 50) {
      doc.addPage();
    } else {
      doc.y = finalY;
      doc.moveDown(0.5);
    }
  }

  // ─── PIE DE PÁGINA ────────────────────────────────────────────────────────
  const range = (doc as any).bufferedPageRange();
  const totalPages = range.count;

  for (let i = 0; i < totalPages; i++) {
    doc.switchToPage(i);
    
    // Para dibujar en el pie de página sin causar un salto automático, modificamos el margen inferior
    const oldBottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    const footerY = doc.page.height - 35;
    doc.moveTo(margin, footerY - 5).lineTo(pageW - margin, footerY - 5).strokeColor(BORDER_GRAY).lineWidth(0.5).stroke();
    
    doc.font("Helvetica").fontSize(7.5).fillColor("#AAAAAA").text(
      `${clinicName} · Documento generado electrónicamente — PodoClinic`,
      margin, footerY, { width: contentW - 60, align: "left", lineBreak: false }
    );
    doc.font("Helvetica").fontSize(7.5).fillColor("#AAAAAA").text(
      `Pág. ${i + 1} / ${totalPages}`,
      margin, footerY, { width: contentW, align: "right", lineBreak: false }
    );

    doc.page.margins.bottom = oldBottomMargin;
  }

  doc.flushPages();
  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  return filePath;
}

/** Dibuja el título de una sección con diseño limpio y subrayado sutil */
function sectionTitle(doc: PDFKit.PDFDocument, title: string, margin: number, accent: string, contentW: number) {
  if (doc.y > 50 && doc.y + 40 > doc.page.height - 50) {
    doc.addPage();
  } else if (doc.y > 50) {
    doc.moveDown(0.5);
  }

  const y = doc.y;
  doc.font("Helvetica-Bold").fontSize(11).fillColor(accent).text(title.toUpperCase(), margin, y);
  doc.moveTo(margin, doc.y + 2).lineTo(margin + contentW, doc.y + 2).strokeColor(accent).lineWidth(1).stroke();
  doc.y += 12;
}
