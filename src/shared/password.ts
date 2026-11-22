import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, KEY_LENGTH);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  // A dummy hash keeps the timing equal when the email does not exist.
  const [saltHex, keyHex] = (stored ?? `${'0'.repeat(32)}:${'0'.repeat(KEY_LENGTH * 2)}`).split(':');
  const expected = Buffer.from(keyHex, 'hex');
  const key = await scryptAsync(password, Buffer.from(saltHex, 'hex'), KEY_LENGTH);
  return !!stored && expected.length === key.length && timingSafeEqual(key, expected);
}
