import { promisify } from 'node:util';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Formato almacenado: scrypt:<saltHex>:<hashHex>
// El login posterior podrá separar estos tres valores y volver a derivar la clave.

export async function hashPassword(plainPassword) {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = await scryptAsync(plainPassword, salt, KEY_LENGTH);

  return `scrypt:${salt.toString('hex')}:${derivedKey.toString('hex')}`;
}

export async function verifyPassword(plainPassword, storedHash) {
  const [algorithm, saltHex, hashHex] = storedHash.split(':');

  if (algorithm !== 'scrypt' || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const derivedKey = await scryptAsync(plainPassword, salt, expected.length);

  if (derivedKey.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derivedKey, expected);
}
