import crypto from "crypto";

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The result is a base64 string encoding: [12-byte IV][16-byte auth tag][ciphertext].
 * Requires ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 */
export function encryptField(text: string): string {
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypts a base64 string previously encrypted with encryptField.
 */
export function decryptField(encoded: string): string {
  const data = Buffer.from(encoded, "base64");
  const key = Buffer.from(process.env.ENCRYPTION_KEY!, "hex");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted).toString("utf8") + decipher.final("utf8");
}
