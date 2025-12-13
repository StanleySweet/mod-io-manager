import crypto from 'crypto';

/**
 * Hash email with HMAC-SHA256 (non-deterministic with secret)
 * @param email - Email to hash
 * @param secret - JWT_SECRET from env
 * @returns Hex string (64 chars)
 */
export function hashEmail(email: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(email.toLowerCase()).digest('hex');
}

