import { FastifyRequest, FastifyReply } from 'fastify';

/**
 * Role-based authorization middleware factory
 * Enforces that the authenticated user has one of the specified roles
 */
export function requireRole(...allowedRoles: Array<'mod_signer' | 'admin'>) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Ensure user is authenticated (should be set by authenticateJWT)
    if (!request.user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Check if user's role is in the allowed roles
    if (!allowedRoles.includes(request.user.role)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
      });
    }
  };
}

/**
 * Shorthand for admin-only routes
 */
export const requireAdmin = requireRole('admin');

/**
 * Shorthand for mod signer or admin routes
 */
export const requireModSigner = requireRole('mod_signer', 'admin');
