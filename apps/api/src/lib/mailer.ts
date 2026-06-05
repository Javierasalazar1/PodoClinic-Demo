import nodemailer from "nodemailer";
import { decryptField } from "./crypto";

interface ClinicSmtp {
  smtp_host: string | null;
  smtp_port: number | null;
  smtp_user: string | null;
  smtp_pass: string | null;
  name?: string;
  email?: string | null;
}

/**
 * Creates a Nodemailer transporter using the clinic's SMTP config.
 * Automatically decrypts smtp_pass from DB.
 * Falls back to Ethereal (test) SMTP if the clinic has no config.
 */
export async function createTransporter(clinic: ClinicSmtp | null) {
  if (clinic?.smtp_host && clinic?.smtp_user && clinic?.smtp_pass) {
    let pass: string;
    try {
      pass = decryptField(clinic.smtp_pass);
    } catch {
      // If decryption fails (e.g. legacy plaintext value), use as-is
      pass = clinic.smtp_pass;
    }
    return nodemailer.createTransport({
      host: clinic.smtp_host,
      port: clinic.smtp_port ?? 587,
      secure: (clinic.smtp_port ?? 587) === 465,
      auth: { user: clinic.smtp_user, pass },
    });
  }

  // Fallback: ethereal test account
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
}

/** Returns the "from" address for outgoing emails */
export function getFromAddress(clinic: ClinicSmtp | null, label = "PodoClinic") {
  return `"${label}" <${clinic?.smtp_user ?? "no-reply@podoclinic.com"}>`;
}
