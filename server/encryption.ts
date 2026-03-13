import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const ENC_PREFIX = 'enc:';

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) return null;
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_LENGTH) {
    console.warn('[encryption] ENCRYPTION_KEY must be 64 hex characters. Credentials stored as plaintext.');
    return null;
  }
  return buf;
}

export function encrypt(plaintext: string | null | undefined): string | null | undefined {
  if (!plaintext) return plaintext;
  const key = getKey();
  if (!key) return plaintext;

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(value: string | null | undefined): string | null | undefined {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;

  const key = getKey();
  if (!key) {
    console.warn('[encryption] Value is encrypted but ENCRYPTION_KEY is not set.');
    return value;
  }

  try {
    const parts = value.slice(ENC_PREFIX.length).split(':');
    if (parts.length !== 3) return value;
    const [ivHex, tagHex, dataHex] = parts;

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const data = Buffer.from(dataHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv) as crypto.DecipherGCM;
    decipher.setAuthTag(tag);
    return decipher.update(data).toString('utf8') + decipher.final('utf8');
  } catch {
    console.error('[encryption] Failed to decrypt value — returning as-is.');
    return value;
  }
}
