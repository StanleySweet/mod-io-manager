import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { getDB } from '../database/db.js';
import { hashEmail } from '../utils/hash.js';
import { hashPassword } from '../utils/password.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/requireRole.js';
import { syncModsFromModio } from '../services/modioSync.js';

// Schemas
const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12).regex(
    /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])/,
    'Password must contain at least 1 uppercase letter, 1 number, and 1 special character'
  ),
  role: z.enum(['mod_signer', 'admin']),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['mod_signer', 'admin']),
});

export default async function adminRoutes(fastify: FastifyInstance) {
  // Register routes under /admin prefix
  await fastify.register(async (adminScope) => {
    // All admin routes require JWT authentication and admin role
    adminScope.addHook('preHandler', authenticateJWT);
    adminScope.addHook('preHandler', requireAdmin);

    /**
     * GET /api/admin/users
     * List all users (admin only)
     */
    adminScope.get('/users', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const db = getDB();
        const users = await db('users')
          .select('id', 'email_hash', 'nickname', 'role', 'created_at')
          .orderBy('created_at', 'desc');

        // Return users without exposing hashes
        const sanitizedUsers = users.map(user => ({
          id: user.id,
          email: user.email_hash, // hashed email for privacy
          nickname: user.nickname,
          role: user.role,
          created_at: user.created_at,
        }));

        return reply.status(200).send(sanitizedUsers);
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch users');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch users',
        });
      }
    });

    /**
     * POST /api/admin/users
     * Create a new user (admin only)
     */
    adminScope.post('/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = CreateUserSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors.map((e) => e.message).join(', '),
      });
    }

    const { email, password, role } = parseResult.data;

    try {
      const db = getDB();

      // Hash email
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Server configuration error',
        });
      }

      const emailHash = hashEmail(email, secret);

      // Check if user already exists
      const existingUser = await db('users').where({ email_hash: emailHash }).first();
      if (existingUser) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User with this email already exists',
        });
      }

      // Hash password
      const passwordHash = await hashPassword(password);

      // Insert user
      const [userId] = await db('users').insert({
        email_hash: emailHash,
        password_hash: passwordHash,
        role,
      });

      // Audit log
      await db('audit_logs').insert({
        user_id: request.user!.id,
        action: 'CREATE_USER',
        resource: userId.toString(),
        details: `Created user with role: ${role}`,
        user_agent: request.headers['user-agent'] || 'unknown',
      });

      return reply.status(201).send({
        message: 'User created successfully',
        userId,
        role,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to create user');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create user',
      });
    }
  });

    /**
     * PATCH /api/admin/users/:id/role
     * Update user role (admin only)
     */
    adminScope.patch('/users/:id/role', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid user ID',
      });
    }

    const parseResult = UpdateRoleSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: parseResult.error.errors.map((e) => e.message).join(', '),
      });
    }

    const { role } = parseResult.data;

    try {
      const db = getDB();

      // Check if user exists
      const user = await db('users').where({ id: userId }).first();
      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Update role
      await db('users').where({ id: userId }).update({ role });

      // Audit log
      await db('audit_logs').insert({
        user_id: request.user!.id,
        action: 'UPDATE_USER_ROLE',
        resource: userId.toString(),
        details: `Changed role to: ${role}`,
        user_agent: request.headers['user-agent'] || 'unknown',
      });

      return reply.status(200).send({
        message: 'User role updated successfully',
        userId,
        role,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to update user role');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update user role',
      });
    }
  });

    /**
     * DELETE /api/admin/users/:id
     * Delete a user (admin only)
     */
    adminScope.delete('/users/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const userId = parseInt(id, 10);

    if (isNaN(userId)) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid user ID',
      });
    }

    // Prevent self-deletion
    if (request.user!.id === userId) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'Cannot delete your own account',
      });
    }

    try {
      const db = getDB();

      // Check if user exists
      const user = await db('users').where({ id: userId }).first();
      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      // Delete user
      await db('users').where({ id: userId }).delete();

      // Audit log
      await db('audit_logs').insert({
        user_id: request.user!.id,
        action: 'DELETE_USER',
        resource: userId.toString(),
        details: `Deleted user account`,
        user_agent: request.headers['user-agent'] || 'unknown',
      });

      return reply.status(200).send({
        message: 'User deleted successfully',
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to delete user');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete user',
      });
    }
  });

    /**
     * GET /api/admin/audit-logs
     * View audit logs with pagination and filtering
     */
    adminScope.get('/audit-logs', async (request: FastifyRequest, reply: FastifyReply) => {
    const { page = '1', limit = '50', action, userId } = request.query as {
      page?: string;
      limit?: string;
      action?: string;
      userId?: string;
    };

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1 || isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid pagination parameters',
      });
    }

    try {
      const db = getDB();

      // Build query
      let query = db('audit_logs')
        .select('audit_logs.*', 'users.nickname')
        .leftJoin('users', 'audit_logs.user_id', 'users.id');

      if (action) {
        query = query.where({ action });
      }

      if (userId) {
        const userIdNum = parseInt(userId, 10);
        if (!isNaN(userIdNum)) {
          query = query.where({ user_id: userIdNum });
        }
      }

      // Get total count
      const countResult = await query.clone().count('* as count').first();
      const total = countResult?.count ? Number(countResult.count) : 0;

      // Get paginated results
      const logs = await query
        .orderBy('timestamp', 'desc')
        .limit(limitNum)
        .offset((pageNum - 1) * limitNum);

      return reply.status(200).send({
        logs,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch audit logs');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch audit logs',
      });
    }
  });

    /**
     * POST /api/admin/sync-mods
     * Manually trigger mod.io synchronization
     */
    adminScope.post('/sync-mods', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        const db = getDB();
        await db('audit_logs').insert({
          user_id: request.user!.id,
          action: 'MODIO_SYNC',
          resource: null,
          details: 'Manual sync triggered',
          user_agent: request.headers['user-agent'] || 'unknown',
        });
        // Trigger sync in background, record user id
        syncModsFromModio(request.log, request.user!.id).catch((err) => {
          request.log.error({ err }, 'Background sync failed');
        });

        return reply.status(202).send({
          message: 'Mod synchronization started',
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to start sync');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to start synchronization',
        });
      }
    });
  }, { prefix: '/admin' });
}
