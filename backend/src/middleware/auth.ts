import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJWT } from '../utils/jwt.js';
import { getDB } from '../database/db.js';

// Extend FastifyRequest to include user property
declare module 'fastify' {
  interface FastifyRequest {
    user?: {
      id: number;
      email: string;
      role: 'mod_signer' | 'admin';
    };
  }
}

/**
 * JWT authentication middleware
 * Verifies Bearer token and attaches user to request
 */
export async function authenticateJWT(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      request.log.error('JWT_SECRET not configured');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Authentication configuration error',
      });
    }

    const payload = await verifyJWT(token, secret);

    if (!payload) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }

    // Fetch user from database to ensure they still exist and get current role
    const db = getDB();
    const user = await db('users')
      .where({ id: payload.userId })
      .first();

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Attach user to request
    request.user = {
      id: user.id,
      email: payload.email,
      role: user.role,
    };
  } catch (error) {
    request.log.error({ err: error }, 'JWT authentication failed');
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired token',
    });
  }
}
