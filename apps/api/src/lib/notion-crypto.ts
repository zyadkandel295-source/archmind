import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Derive a 32-byte AES key from a passphrase using SHA-256.
 * Reuses the existing JWT_ACCESS_SECRET to avoid introducing another secret.
 */
function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}

/**
 * Encrypt a plaintext token using AES-256-GCM.
 * Returns a string in the format: `iv:authTag:ciphertext` (all base64-encoded).
 * The auth tag provides tamper detection (authenticated encryption).
 */
export function encryptToken(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted
  ].join(":");
}

/**
 * Decrypt a token that was encrypted with `encryptToken`.
 * Throws if the token is corrupted, tampered, or the secret is wrong.
 */
export function decryptToken(encryptedStr: string, secret: string): string {
  const parts = encryptedStr.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format");
  }

  const [ivB64, authTagB64, ciphertext] = parts as [string, string, string];
  const key = deriveKey(secret);
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted token: IV or auth tag length mismatch");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

/**
 * Generate a cryptographically secure OAuth state parameter.
 * 32 random bytes → 64-character hex string.
 */
export function generateOAuthState(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Mask a Notion token for safe logging (e.g. `ntn_***...***`).
 * Never logs the full token.
 */
export function maskToken(token: string): string {
  if (!token || token.length < 8) return "***";
  return `${token.slice(0, 4)}***${token.slice(-3)}`;
}
