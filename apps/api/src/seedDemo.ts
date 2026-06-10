import bcrypt from "bcrypt";
import prisma from "./lib/prisma";

/**
 * Seed de demostración.
 * Limpia todos los datos y recarga un estado inicial ficticio con:
 *  - Clínica "Clínica Demo Podelyx"
 *  - 1 usuario demo (admin) + 2 especialistas ficticios
 *  - 5 pacientes con consultas completas y fotografías de ejemplo
 *
 * Ejecutar con: npm run seed:demo
 * También se ejecuta automáticamente cada 24h si DEMO_MODE=true
 */

const CLINIC_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_USER_ID = "00000000-0000-0000-0000-000000000010";
const SPECIALIST_1_ID = "00000000-0000-0000-0000-000000000011";
const SPECIALIST_2_ID = "00000000-0000-0000-0000-000000000012";

const PATIENT_IDS = [
  "00000000-0000-0000-0001-000000000001",
  "00000000-0000-0000-0001-000000000002",
  "00000000-0000-0000-0001-000000000003",
  "00000000-0000-0000-0001-000000000004",
  "00000000-0000-0000-0001-000000000005",
];

const CONSULTATION_IDS = [
  "00000000-0000-0000-0002-000000000001",
  "00000000-0000-0000-0002-000000000002",
  "00000000-0000-0000-0002-000000000003",
  "00000000-0000-0000-0002-000000000004",
  "00000000-0000-0000-0002-000000000005",
];

// Fotografías de ejemplo usando placeholders de Picsum (sin necesidad de S3)
function makeDemoPhotos(consultationId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    consultation_id: consultationId,
    url: `https://picsum.photos/seed/podo-${consultationId.slice(-4)}-${i}/800/600`,
    thumbnail_url: `https://picsum.photos/seed/podo-${consultationId.slice(-4)}-${i}/200/150`,
    label: ["Planta izquierda", "Planta derecha", "Vista lateral", "Detalle uña", "Zona metatarsal"][i] ?? `Foto ${i + 1}`,
    order_index: i,
  }));
}

async function clearData() {
  console.log("🗑️  Limpiando datos existentes...");
  // Orden correcto para respetar FK constraints
  await prisma.consentRecord.deleteMany({});
  await prisma.consultationPhoto.deleteMany({});
  await prisma.consultation.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  // @ts-ignore
  await prisma.emailChangeToken.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.clinic.deleteMany({});
  console.log("✅ Datos eliminados");
}

async function main() {
  console.log("🌱 Iniciando seed demo de Podelyx...\n");

  await clearData();

  // ── Clínica ──────────────────────────────────────────────────────────
  const clinic = await prisma.clinic.create({
    data: {
      id: CLINIC_ID,
      name: "Clínica Demo Podelyx",
      address: "Av. Providencia 1234, Of. 502, Providencia, Santiago",
      phone: "+56 2 2345 6789",
      email: "contacto@demo-Podelyx.cl",
      website: "https://demo.Podelyx.cl",
      primary_color: "#0F6E56",
      consent_text:
        "CONSENTIMIENTO INFORMADO\n\nYo, el/la paciente, declaro haber sido informado/a sobre los procedimientos podológicos a realizar, sus riesgos y beneficios. Autorizo voluntariamente la realización del tratamiento podológico y el registro de mis datos clínicos en el sistema Podelyx.\n\nLos datos personales serán tratados con absoluta confidencialidad conforme a la Ley 19.628 de protección de datos personales de Chile.\n\n[NOTA: Estos son datos de demostración. En producción, aquí va el texto legal real de tu clínica.]",
    },
  });
  console.log(`✅ Clínica: ${clinic.name}`);

  // ── Usuarios ──────────────────────────────────────────────────────────
  const demoHash = await bcrypt.hash("Demo1234!", 12);
  const spec1Hash = await bcrypt.hash("Especialista1!", 12);
  const spec2Hash = await bcrypt.hash("Especialista2!", 12);

  const demoUser = await prisma.user.create({
    data: {
      id: DEMO_USER_ID,
      clinic_id: CLINIC_ID,
      role: "ADMIN",
      full_name: "Usuario Demo",
      email: "demo@Podelyx.cl",
      password_hash: demoHash,
      totp_enabled: false,
      is_active: true,
    },
  });
  console.log(`✅ Usuario demo: ${demoUser.email}`);

  const specialist1 = await prisma.user.create({
    data: {
      id: SPECIALIST_1_ID,
      clinic_id: CLINIC_ID,
      role: "SPECIALIST",
      full_name: "Dra. Ana González Reyes",
      professional_title: "Podóloga Clínica",
      license_number: "POD-12345",
      email: "ana.gonzalez@demo-Podelyx.cl",
      password_hash: spec1Hash,
      totp_enabled: false,
      is_active: true,
    },
  });
  console.log(`✅ Especialista 1: ${specialist1.full_name}`);

  const specialist2 = await prisma.user.create({
    data: {
      id: SPECIALIST_2_ID,
      clinic_id: CLINIC_ID,
      role: "SPECIALIST",
      full_name: "Dr. Rodrigo Muñoz Salinas",
      professional_title: "Podólogo y Quiropodiatra",
      license_number: "POD-67890",
      email: "rodrigo.munoz@demo-Podelyx.cl",
      password_hash: spec2Hash,
      totp_enabled: false,
      is_active: true,
    },
  });
  console.log(`✅ Especialista 2: ${specialist2.full_name}`);

  // ── Pacientes ─────────────────────────────────────────────────────────
  const patientsData = [
    {
      id: PATIENT_IDS[0],
      national_id: "12.345.678-9",
      full_name: "María Fernanda López Castillo",
      date_of_birth: new Date("1982-03-15"),
      biological_sex: "FEMALE" as const,
      phone: "+56 9 8765 4321",
      email: "maria.lopez@demo.cl",
      address: "Calle Los Aromos 456, Las Condes",
      emergency_contact_name: "Pedro López",
      emergency_contact_phone: "+56 9 1111 2222",
    },
    {
      id: PATIENT_IDS[1],
      national_id: "9.876.543-2",
      full_name: "Carlos Eduardo Martínez Vega",
      date_of_birth: new Date("1968-08-22"),
      biological_sex: "MALE" as const,
      phone: "+56 9 1234 5678",
      email: "carlos.martinez@demo.cl",
      address: "Av. Irarrázaval 890, Ñuñoa",
      emergency_contact_name: "Rosa Vega",
      emergency_contact_phone: "+56 9 3333 4444",
    },
    {
      id: PATIENT_IDS[2],
      national_id: "11.222.333-4",
      full_name: "Patricia Andrea Soto Vargas",
      date_of_birth: new Date("1991-11-03"),
      biological_sex: "FEMALE" as const,
      phone: "+56 9 5555 6666",
      email: "patricia.soto@demo.cl",
      address: "Pasaje Las Flores 12, Pudahuel",
    },
    {
      id: PATIENT_IDS[3],
      national_id: "15.444.555-6",
      full_name: "Jorge Alejandro Pérez Rojas",
      date_of_birth: new Date("1975-05-17"),
      biological_sex: "MALE" as const,
      phone: "+56 9 7777 8888",
      address: "Calle Maipú 321, Maipú",
      emergency_contact_name: "Carmen Rojas",
      emergency_contact_phone: "+56 9 9999 0000",
    },
    {
      id: PATIENT_IDS[4],
      national_id: "17.888.999-0",
      full_name: "Valentina Ignacia Torres Medina",
      date_of_birth: new Date("2001-01-28"),
      biological_sex: "FEMALE" as const,
      phone: "+56 9 2222 3333",
      email: "valentina.torres@demo.cl",
      address: "Av. Grecia 754, Peñalolén",
    },
  ];

  for (const p of patientsData) {
    await prisma.patient.create({ data: { ...p, clinic_id: CLINIC_ID } });
    console.log(`✅ Paciente: ${p.full_name}`);
  }

  // ── Consultas completas ───────────────────────────────────────────────
  const consultationsData = [
    {
      id: CONSULTATION_IDS[0],
      patient_id: PATIENT_IDS[0],
      specialist_id: SPECIALIST_1_ID,
      status: "FINALIZED" as const,
      consultation_date: new Date("2026-05-10T10:00:00"),
      consultation_type: "FIRST_TIME" as const,
      chief_complaint: "Dolor en el talón derecho al caminar, lleva 3 semanas",
      podiatric_history: {
        previous_treatments: "Plantillas ortopédicas hace 2 años",
        surgeries: "Ninguna",
        footwear: "Zapatos de trabajo de cuero, puntera estrecha",
        sport_activity: "Caminata 30 min diarios",
      },
      medical_history: {
        pathologies: "Hipertensión controlada",
        medications: "Losartán 50mg/día",
        allergies: "Penicilina",
        diabetes: false,
      },
      lifestyle: {
        smoking: false,
        alcohol: "Ocasional",
        occupation: "Profesora",
        bmi: 26.4,
      },
      clinical_examination: {
        skin_color: "Normal",
        temperature: "Normal",
        edema: "No presenta",
        capillary_refill: "< 2 seg",
        calluses: "Callo moderado en 5.° metatarso derecho",
        nails: "Onicofosis leve bilateral",
        deformities: "Hallux valgus grado I derecho",
      },
      biomechanical_evaluation: {
        gait: "Antálgica lateral derecha",
        foot_type: "Pronado bilateral",
        arch: "Pie plano grado II",
        range_of_motion: "Leve limitación en flexión dorsal tobillo derecho",
      },
      vascular_neurological: {
        tibial_pulse: "Presente bilateral",
        pedal_pulse: "Presente bilateral",
        monofilament: "Sensibilidad conservada",
        vibration: "Normal",
      },
      treatment_plan: {
        diagnosis: "Fascitis plantar derecha + Hallux valgus grado I",
        treatment: "Descarga de fascia, electroterapia, plantilla ortopédica personalizada",
        sessions: 6,
        next_visit: "2026-05-24",
        recommendations: "Cambiar calzado, ejercicios de elongación de fascia plantar, hielo 10 min post actividad",
      },
      report_pdf_url: "https://demo.Podelyx.cl/reports/demo-consulta-001.pdf",
    },
    {
      id: CONSULTATION_IDS[1],
      patient_id: PATIENT_IDS[1],
      specialist_id: SPECIALIST_2_ID,
      status: "FINALIZED" as const,
      consultation_date: new Date("2026-05-12T14:30:00"),
      consultation_type: "FOLLOW_UP" as const,
      chief_complaint: "Seguimiento de uña encarnada pie derecho, post-tratamiento",
      podiatric_history: {
        previous_treatments: "Onicocriptosis tratada hace 3 meses con resección parcial",
        footwear: "Zapatos deportivos talla correcta",
      },
      medical_history: {
        pathologies: "Diabetes tipo 2 controlada",
        medications: "Metformina 850mg c/12h",
        allergies: "Ninguna",
        diabetes: true,
        hba1c: "6.8%",
      },
      lifestyle: {
        smoking: false,
        occupation: "Conductor de buses",
        bmi: 29.1,
      },
      clinical_examination: {
        skin_color: "Eritema leve periungeal",
        nails: "Recidiva de onicocriptosis grado I en 1er dedo pie derecho",
        granulation: "Tejido de granulación leve lateral derecho",
      },
      vascular_neurological: {
        tibial_pulse: "Presente bilateral, disminuido izquierdo",
        pedal_pulse: "Presente bilateral",
        monofilament: "Hipo-estesia leve dedos pie derecho",
      },
      treatment_plan: {
        diagnosis: "Recidiva onicocriptosis grado I — riesgo pie diabético",
        treatment: "Fresar borde lateral, apósito antiséptico, seguimiento quincenal",
        sessions: 3,
        next_visit: "2026-05-26",
        recommendations: "Control podológico mensual, calzado de horma ancha, inspección diaria de pies",
      },
      report_pdf_url: "https://demo.Podelyx.cl/reports/demo-consulta-002.pdf",
    },
    {
      id: CONSULTATION_IDS[2],
      patient_id: PATIENT_IDS[2],
      specialist_id: SPECIALIST_1_ID,
      status: "FINALIZED" as const,
      consultation_date: new Date("2026-05-15T09:00:00"),
      consultation_type: "FIRST_TIME" as const,
      chief_complaint: "Verrugas plantares múltiples en pie izquierdo, dolorosas",
      podiatric_history: {
        previous_treatments: "Ácido salicílico tópico sin resultado",
        footwear: "Zapatillas deportivas, comparte calzado familiar (factor de riesgo)",
      },
      medical_history: {
        pathologies: "Sin antecedentes relevantes",
        medications: "Ninguno",
        allergies: "Ninguna",
        diabetes: false,
      },
      lifestyle: {
        smoking: false,
        gym: "3 veces/semana, usa piscina",
        occupation: "Estudiante universitaria",
        bmi: 22.1,
      },
      clinical_examination: {
        lesions: "3 verrugas plantares (papilomas) en zona metatarsal izquierda, mayor de 8mm",
        skin_color: "Normal",
        nails: "Sin alteraciones",
        punctate_bleeding: "Presente al fresar superficie",
      },
      treatment_plan: {
        diagnosis: "Papilomatosis plantar múltiple (VPH) pie izquierdo",
        treatment: "Crioterapia con nitrógeno líquido, 3 sesiones cada 2 semanas",
        sessions: 3,
        next_visit: "2026-05-29",
        recommendations: "No compartir calzado, uso de chanclas en duchas/piscinas, vitamina C",
      },
      report_pdf_url: "https://demo.Podelyx.cl/reports/demo-consulta-003.pdf",
    },
    {
      id: CONSULTATION_IDS[3],
      patient_id: PATIENT_IDS[3],
      specialist_id: SPECIALIST_2_ID,
      status: "FINALIZED" as const,
      consultation_date: new Date("2026-05-20T11:00:00"),
      consultation_type: "URGENT" as const,
      chief_complaint: "Dolor agudo en 4.° dedo pie derecho, posible fractura por golpe",
      podiatric_history: {
        previous_treatments: "Ninguno",
        mechanism: "Golpe contra mueble hace 2 días",
      },
      medical_history: {
        pathologies: "Hiperuricemia (gota), sin tratamiento actual",
        medications: "Ibuprofeno 400mg SOS",
        allergies: "Ninguna",
        diabetes: false,
      },
      lifestyle: {
        smoking: true,
        occupation: "Mecánico",
        bmi: 31.5,
      },
      clinical_examination: {
        skin_color: "Equimosis y edema 4.° dedo derecho",
        pain_scale: "8/10",
        range_of_motion: "Muy limitado",
        crepitation: "No palpable",
        nails: "Hematoma subungeal 4.° dedo",
      },
      treatment_plan: {
        diagnosis: "Contusión severa 4.° dedo pie derecho — descartar fractura (derivar Rx)",
        treatment: "Inmovilización con tape kinesiológico, drenaje hematoma subungeal, derivación a urgencia traumatológica",
        next_visit: "Post confirmación Rx",
        recommendations: "Reposo, elevación del pie, hielo 15 min c/4h, evitar calzado cerrado",
        referral: "Traumatología HSBA — Rx antero-posterior y oblicua del pie",
      },
      report_pdf_url: "https://demo.Podelyx.cl/reports/demo-consulta-004.pdf",
    },
    {
      id: CONSULTATION_IDS[4],
      patient_id: PATIENT_IDS[4],
      specialist_id: SPECIALIST_1_ID,
      status: "FINALIZED" as const,
      consultation_date: new Date("2026-05-22T16:00:00"),
      consultation_type: "FOLLOW_UP" as const,
      chief_complaint: "Control post-tratamiento hongos en uñas, 2.ª sesión",
      podiatric_history: {
        previous_treatments: "Onicomicosis tratada con antimicótico tópico 6 semanas",
        evolution: "Mejoría parcial en 1er y 2.° dedo, persiste en 3.°",
      },
      medical_history: {
        pathologies: "Sin antecedentes",
        medications: "Ciclopirox laca 8% (en curso)",
        allergies: "Ninguna",
        diabetes: false,
      },
      lifestyle: {
        occupation: "Estudiante",
        gym: "Atletismo, 5 veces/semana",
        bmi: 20.8,
      },
      clinical_examination: {
        nails: "Onicomicosis grado II: 1.° y 2.° dedo mejoran. 3.° dedo sin respuesta al tópico",
        color: "Amarillento, engrosamiento moderado 3.° dedo",
        skin: "Tinea pedis interdigital leve resuelto",
      },
      treatment_plan: {
        diagnosis: "Onicomicosis resistente a tópico en 3.° dedo — escalada terapéutica",
        treatment: "Fresar uña 3.°, aplicar solución antifúngica directa. Evaluar antimicótico oral con médico",
        sessions: 2,
        next_visit: "2026-06-05",
        recommendations: "Continuar laca en 1.° y 2.°, medias de algodón, calzado ventilado, desinfección de calzado con spray antifúngico",
      },
      report_pdf_url: "https://demo.Podelyx.cl/reports/demo-consulta-005.pdf",
    },
  ];

  for (const c of consultationsData) {
    const { id: consultationId, ...rest } = c;
    const consultation = await prisma.consultation.create({
      data: {
        id: consultationId,
        clinic_id: CLINIC_ID,
        ...rest,
      },
    });

    // Agregar fotos de ejemplo a cada consulta
    const photoCount = [3, 2, 4, 2, 3][consultationsData.indexOf(c)];
    await prisma.consultationPhoto.createMany({
      data: makeDemoPhotos(consultation.id, photoCount),
    });

    console.log(`✅ Consulta #${consultationsData.indexOf(c) + 1} para paciente ${rest.patient_id.slice(-4)} con ${photoCount} fotos`);
  }

  console.log("\n🎉 Seed demo completado exitosamente!");
  console.log("\n📋 Credenciales de acceso:");
  console.log("   👤 Demo Admin:    demo@Podelyx.cl     / Demo1234!");
  console.log("   👩‍⚕️ Especialista 1: ana.gonzalez@demo-Podelyx.cl / Especialista1!");
  console.log("   👨‍⚕️ Especialista 2: rodrigo.munoz@demo-Podelyx.cl / Especialista2!");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed demo:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
