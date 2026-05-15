const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH  = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey() {
  const hex = process.env.PII_ENCRYPTION_KEY;
  if (!hex || hex.trim().length !== 64) {
    throw new Error("PII_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)");
  }
  return Buffer.from(hex.trim(), "hex");
}

/**
 * Encrypts a plaintext string.
 * @returns {string} "iv:authTag:ciphertext" — all hex-encoded.
 */
function encryptField(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const key    = getKey();
  const iv     = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts a payload produced by encryptField.
 * @param {string} payload "iv:authTag:ciphertext"
 * @returns {string} original plaintext
 */
function decryptField(payload) {
  if (!payload) return null;
  const [ivHex, authTagHex, encryptedHex] = payload.split(":");
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error("Invalid encrypted payload");

  const key       = getKey();
  const iv        = Buffer.from(ivHex, "hex");
  const authTag   = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

module.exports = { encryptField, decryptField };
