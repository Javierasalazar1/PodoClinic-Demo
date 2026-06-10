process.env.NODE_ENV = "test";
import test from "node:test";
import assert from "node:assert";
import { Server } from "http";
import app from "../index";
import prisma from "../lib/prisma";

// We'll run the integration test on a dynamically allocated port
let server: Server;
let apiBaseUrl: string;

test.before(async () => {
  return new Promise<void>((resolve) => {
    server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === "string" ? 0 : address?.port;
      apiBaseUrl = `http://localhost:${port}/api/v1`;
      console.log(`[TEST] Test server started at ${apiBaseUrl}`);
      resolve();
    });
  });
});

test.after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    console.log("[TEST] Test server stopped");
  }
  // Disconnect prisma
  await prisma.$disconnect();
});

test("Consultation workflow: create draft -> save consent -> finalize", async (t) => {
  // 1. Login
  const loginRes = await fetch(`${apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.TEST_ADMIN_EMAIL || "admin@Podelyx-demo.cl",
      password: process.env.TEST_ADMIN_PASSWORD || ""
    })
  });

  assert.strictEqual(loginRes.status, 200, "Login should succeed");
  const { accessToken } = await loginRes.json() as { accessToken: string };
  assert.ok(accessToken, "Access token should be returned");

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${accessToken}`
  };

  // 2. Create a draft consultation
  const consultationDate = new Date().toISOString();
  const createRes = await fetch(`${apiBaseUrl}/consultations`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      patient_id: "demo-patient-12345678-9",
      consultation_date: consultationDate,
      consultation_type: "FIRST_TIME",
      chief_complaint: "Dolor en el metatarso (Integration Test)",
      podiatric_history: { prev_consultations: false },
      medical_history: { systemic_diseases: ["Diabetes mellitus"] },
      lifestyle: { physical_activity: "SEDENTARY" },
      clinical_examination: { nail_status: "Normal" },
      biomechanical_evaluation: { footprint_type_right: "NEUTRAL" },
      vascular_neurological: { pedal_pulse_right: "PRESENT" },
      treatment_plan: { diagnosis: "Metatarsalgia leve" }
    })
  });

  assert.strictEqual(createRes.status, 201, "Draft creation should return 201");
  const { id: consultationId } = await createRes.json() as { id: string };
  assert.ok(consultationId, "Consultation ID should be returned");

  // 3. Try to finalize without consent (should fail)
  const finalizeFailRes = await fetch(`${apiBaseUrl}/consultations/${consultationId}/finalize`, {
    method: "POST",
    headers: authHeaders
  });
  assert.strictEqual(finalizeFailRes.status, 400, "Finalizing without consent should fail with 400");
  const finalizeFailJson = await finalizeFailRes.json() as { error: string; code: string };
  assert.strictEqual(finalizeFailJson.code, "CONSENT_REQUIRED", "Error code should be CONSENT_REQUIRED");

  // 4. Save consent
  const consentRes = await fetch(`${apiBaseUrl}/consultations/${consultationId}/consent`, {
    method: "POST",
    headers: authHeaders,
    body: JSON.stringify({
      patient_signature_name: "María Fernanda López",
      patient_signature_rut: "12345678-9",
      signature_data_url: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
      consent_accepted: true
    })
  });

  assert.strictEqual(consentRes.status, 200, "Saving consent should succeed with 200");
  const consentJson = await consentRes.json() as { id: string; consultation_id: string };
  assert.strictEqual(consentJson.consultation_id, consultationId, "Consent record should match consultation ID");

  // Verify in DB that it exists
  const dbConsent = await prisma.consentRecord.findUnique({
    where: { consultation_id: consultationId }
  });
  assert.ok(dbConsent, "Consent record should exist in database");
  assert.strictEqual(dbConsent.patient_full_name, "María Fernanda López", "Name should match");

  // 5. Finalize consultation (should now succeed)
  const finalizeSuccessRes = await fetch(`${apiBaseUrl}/consultations/${consultationId}/finalize`, {
    method: "POST",
    headers: authHeaders
  });

  assert.strictEqual(finalizeSuccessRes.status, 200, "Finalization should succeed with 200");
  const finalizeSuccessJson = await finalizeSuccessRes.json() as { status: string };
  assert.strictEqual(finalizeSuccessJson.status, "FINALIZED", "Status should be updated to FINALIZED in database");

  // Cleanup: delete test consultation and consent from DB to keep it clean
  await prisma.consentRecord.delete({ where: { consultation_id: consultationId } });
  await prisma.consultationPhoto.deleteMany({ where: { consultation_id: consultationId } });
  await prisma.consultation.delete({ where: { id: consultationId } });
});
