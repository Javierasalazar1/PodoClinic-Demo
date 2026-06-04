import bcrypt from "bcrypt";
import prisma from "./lib/prisma";

/**
 * Script de seed inicial.
 * Crea una clínica demo y un usuario administrador por defecto.
 * Ejecutar con: npm run db:seed
 */
async function main() {
  console.log("🌱 Iniciando seed de base de datos...");

  // Crear clínica demo
  const clinic = await prisma.clinic.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Clínica Podológica Demo",
      address: "Av. Providencia 1234, Santiago",
      phone: "+56 2 1234 5678",
      email: "contacto@podoclinic-demo.cl",
      primary_color: "#0F6E56",
      consent_text: `CONSENTIMIENTO INFORMADO\n\nYo, el/la paciente, declaro haber sido informado/a sobre los procedimientos podológicos a realizar, sus riesgos y beneficios. Autorizo voluntariamente la realización del tratamiento podológico y el registro de mis datos clínicos en el sistema PodoClinic.\n\nLos datos personales serán tratados con absoluta confidencialidad conforme a la Ley 19.628 de protección de datos personales de Chile.`,
    },
  });
  console.log(`✅ Clínica creada: ${clinic.name}`);

  // Crear usuario administrador
  const passwordHash = await bcrypt.hash("Admin1234!", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@podoclinic-demo.cl" },
    update: {},
    create: {
      clinic_id: clinic.id,
      role: "ADMIN",
      full_name: "Administrador PodoClinic",
      email: "admin@podoclinic-demo.cl",
      password_hash: passwordHash,
      totp_enabled: false,
      is_active: true,
    },
  });
  console.log(`✅ Admin creado: ${admin.email}`);

  // Crear especialista demo
  const specialistHash = await bcrypt.hash("Specialist1234!", 12);
  const specialist = await prisma.user.upsert({
    where: { email: "especialista@podoclinic-demo.cl" },
    update: {},
    create: {
      clinic_id: clinic.id,
      role: "SPECIALIST",
      full_name: "Dr. Ana González",
      professional_title: "Podóloga Clínica",
      license_number: "POD-12345",
      email: "especialista@podoclinic-demo.cl",
      password_hash: specialistHash,
      totp_enabled: false,
      is_active: true,
    },
  });
  console.log(`✅ Especialista creado: ${specialist.email}`);

  // Crear pacientes demo
  const patients = [
    {
      national_id: "12345678-9",
      full_name: "María Fernanda López",
      date_of_birth: new Date("1985-03-15"),
      biological_sex: "FEMALE" as const,
      phone: "+56 9 8765 4321",
      email: "maria.lopez@email.com",
    },
    {
      national_id: "98765432-1",
      full_name: "Carlos Eduardo Martínez",
      date_of_birth: new Date("1972-08-22"),
      biological_sex: "MALE" as const,
      phone: "+56 9 1234 5678",
    },
    {
      national_id: "11222333-4",
      full_name: "Patricia Soto Vargas",
      date_of_birth: new Date("1990-11-03"),
      biological_sex: "FEMALE" as const,
      email: "patricia.soto@email.com",
    },
  ];

  for (const p of patients) {
    const patient = await prisma.patient.upsert({
      where: { id: `demo-patient-${p.national_id}` },
      update: {},
      create: {
        id: `demo-patient-${p.national_id}`,
        clinic_id: clinic.id,
        ...p,
      },
    });
    console.log(`✅ Paciente creado: ${patient.full_name}`);
  }

  console.log("\n🎉 Seed completado exitosamente!");
  console.log("\n📋 Credenciales de acceso:");
  console.log("   Admin:       admin@podoclinic-demo.cl / Admin1234!");
  console.log("   Especialista: especialista@podoclinic-demo.cl / Specialist1234!");
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
