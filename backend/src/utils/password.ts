import argon2 from 'argon2';

/**
 * Hash password with Argon2id (recommended settings)
 * @param password - Plain text password
 * @returns Argon2 hash string
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    timeCost: 3,
    memoryCost: 65536, // 64 MiB
    parallelism: 4,
  });
}

/**
 * Verify password against Argon2 hash
 * @param hash - Stored Argon2 hash
 * @param password - Plain text password to verify
 * @returns True if match
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
