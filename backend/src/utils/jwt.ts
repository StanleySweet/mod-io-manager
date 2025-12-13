import { SignJWT, jwtVerify } from 'jose';

interface CustomJWTPayload {
  userId: number;
  email: string;
  role: 'mod_signer' | 'admin';
}

/**
 * Sign JWT token with 1 hour expiration
 * @param payload - User data to encode
 * @param secret - JWT_SECRET from env
 * @returns JWT string
 */
export async function signJWT(payload: CustomJWTPayload, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const secretKey = encoder.encode(secret);

  return new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(secretKey);
}

/**
 * Verify and decode JWT token
 * @param token - JWT string
 * @param secret - JWT_SECRET from env
 * @returns Decoded payload or null if invalid
 */
export async function verifyJWT(token: string, secret: string): Promise<CustomJWTPayload | null> {
  try {
    const encoder = new TextEncoder();
    const secretKey = encoder.encode(secret);

    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as CustomJWTPayload;
  } catch {
    return null;
  }
}
