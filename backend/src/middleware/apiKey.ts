import { FastifyRequest, FastifyReply } from 'fastify';
import { getDB } from '../database/db.js';
import { verifyPassword } from '../utils/password.js';

declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: { id: number; role: string };
  }
}

export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing or invalid API key' });
  }
  const providedKey = authHeader.substring(7);
  const db = getDB();
  const keys = await db('api_keys').whereNull('revoked_at').select('id', 'key_hash', 'role');
  for (const key of keys) {
    if (await verifyPassword(key.key_hash, providedKey)) {
      await db('api_keys').where({ id: key.id }).update({ last_used_at: new Date() });
      request.apiKey = { id: key.id, role: key.role };
      return;
    }
  }
  return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid API key' });
}