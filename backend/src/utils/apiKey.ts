import crypto from 'crypto';

/**
 * Generate a new plaintext API key (mk_ + 32 random bytes as hex).
 * Callers must hash it with hashPassword before storing.
 */
export function generateApiKey(): string {
  return `mk_${crypto.randomBytes(32).toString('hex')}`;
}
