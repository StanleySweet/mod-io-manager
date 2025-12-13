import { FastifyPluginAsync } from 'fastify';
import { getDB } from '../database/db.js';
import { RegisterRequestSchema, LoginRequestSchema, ChangePasswordSchema } from '../schemas/auth.js';
import { hashEmail } from '../utils/hash.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signJWT } from '../utils/jwt.js';
import { authenticateJWT } from '../middleware/auth.js';
import { ZodError } from 'zod';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  const db = getDB();
  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    throw new Error('JWT_SECRET not configured');
  }

  // POST /api/auth/register
  fastify.post('/auth/register', async (request, reply) => {
    try {
      const body = RegisterRequestSchema.parse(request.body);

      // Hash email with HMAC-SHA256
      const emailHash = hashEmail(body.email, jwtSecret);

      // Check if user exists
      const existingUser = await db('users').where({ email_hash: emailHash }).first();
      if (existingUser) {
        return reply.status(409).send({ error: 'Email already in use' });
      }

      // Ensure nickname is unique
      const existingNick = await db('users').where({ nickname: body.nickname }).first();
      if (existingNick) {
        return reply.status(409).send({ error: 'Nickname already in use' });
      }

      // Hash password with Argon2
      const passwordHash = await hashPassword(body.password);

      // Insert user
      const [userId] = await db('users').insert({
        email_hash: emailHash,
        password_hash: passwordHash,
        nickname: body.nickname,
        role: 'mod_signer', // All new users are mod_signer by default
      });

      // Audit log
      await db('audit_logs').insert({
        user_id: userId,
        action: 'CREATE_USER',
        resource: userId.toString(),
        details: `Registered new account with nickname: ${body.nickname}`,
        user_agent: request.headers['user-agent'] || null,
      });

      return reply.status(201).send({ 
        message: 'User created successfully',
        userId 
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({ 
          error: 'Validation failed',
          details: error.errors 
        });
      }
      fastify.log.error({ err: error }, 'Registration error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/login
  fastify.post('/auth/login', {
    config: {
      rateLimit: {
        max: parseInt(process.env.LOGIN_RATE_LIMIT_MAX || '5'),
        timeWindow: parseInt(process.env.LOGIN_RATE_LIMIT_TIMEWINDOW || '60000'),
      },
    },
  }, async (request, reply) => {
    try {
      const body = LoginRequestSchema.parse(request.body);

      // Hash email
      const emailHash = hashEmail(body.email, jwtSecret);

      // Find user
      const user = await db('users').where({ email_hash: emailHash }).first();
      if (!user) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Verify password
      const isValid = await verifyPassword(user.password_hash, body.password);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid email or password' });
      }

      // Generate JWT
      const token = await signJWT({
        userId: user.id,
        email: body.email,
        role: user.role,
        nickname: user.nickname,
      }, jwtSecret);

      // Audit log
      await db('audit_logs').insert({
        user_id: user.id,
        action: 'LOGIN',
        resource: user.id.toString(),
        details: `Successful login`,
        user_agent: request.headers['user-agent'] || null,
      });

      return reply.send({
        token,
        user: {
          id: user.id,
          email: body.email,
          role: user.role,
          nickname: user.nickname,
        },
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({ 
          error: 'Validation failed',
          details: error.errors 
        });
      }
      fastify.log.error({ err: error }, 'Login error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  // POST /api/auth/change-password
  fastify.post('/auth/change-password', {
    preHandler: authenticateJWT,
  }, async (request, reply) => {
    try {
      const body = ChangePasswordSchema.parse(request.body);

      // Hash email
      const emailHash = hashEmail(request.user!.email, jwtSecret);

      // Find user
      const user = await db('users').where({ email_hash: emailHash }).first();
      if (!user) {
        return reply.status(401).send({ error: 'User not found' });
      }

      // Verify current password
      const isValid = await verifyPassword(user.password_hash, body.currentPassword);
      if (!isValid) {
        return reply.status(401).send({ error: 'Current password is incorrect' });
      }

      // Hash new password
      const newPasswordHash = await hashPassword(body.newPassword);

      // Update password
      await db('users').where({ id: user.id }).update({
        password_hash: newPasswordHash,
        updated_at: db.fn.now(),
      });

      // Audit log
      await db('audit_logs').insert({
        user_id: user.id,
        action: 'CHANGE_PASSWORD',
        resource: user.id.toString(),
        details: `Password updated successfully`,
        user_agent: request.headers['user-agent'] || null,
      });

      return reply.send({
        message: 'Password changed successfully',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return reply.status(400).send({ 
          error: 'Validation failed',
          details: error.errors 
        });
      }
      fastify.log.error({ err: error }, 'Password change error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
};

export default authPlugin;
