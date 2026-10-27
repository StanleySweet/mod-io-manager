import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import { authenticateApiKey } from '../middleware/apiKey.js';
import { getDB } from '../database/db.js';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import crypto from 'crypto';

const queuePlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: 1024 * 1024 * 1024, fieldSize: 64 * 1024 * 1024 }, // 1GB zip, reports list every zip entry
  });

  // GET /api/v1/queue/next - claim next pending task
  fastify.get('/v1/queue/next', { preHandler: authenticateApiKey }, async (_request, reply) => {
    const db = getDB();

    // Atomic claim using UPDATE with subquery (SQLite compatible)
    const claimed = await db.raw(`
      UPDATE queue_tasks
      SET status = 'claimed',
          claimed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = (
        SELECT id FROM queue_tasks
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
      )
      RETURNING *
    `);

    const task = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'No pending tasks' });
    }

    const mod = await db('mods').where({ id: task.mod_id }).first();
    const modVersion = await db('mod_versions').where({ id: task.mod_version_id }).first();

    if (!mod || !modVersion || !modVersion.mod_io_file_id) {
      await db('queue_tasks').where({ id: task.id }).update({ status: 'failed', error: 'Mod, mod version or mod.io file id not found' });
      return reply.status(404).send({ error: 'Not Found', message: 'Mod, mod version or mod.io file id not found' });
    }

    const baseUrl = process.env.MODIO_BASE_URL || 'https://g-5.modapi.io/v1';
    const gameId = process.env.MODIO_GAME_ID || '5';

    return {
      task: {
        id: task.id,
        mod_id: task.mod_id,
        mod_version_id: task.mod_version_id,
        task_type: task.task_type,
        payload: task.payload ? JSON.parse(task.payload) : {},
      },
      mod: {
        name: mod.name,
        mod_io_url: mod.mod_io_url,
        version: modVersion.version,
        download_url: `${baseUrl}/games/${gameId}/mods/${mod.mod_io_id}/files/${modVersion.mod_io_file_id}/download`,
        md5: modVersion.md5,
        filesize: modVersion.filesize,
      },
    };
  });

  // POST /api/v1/mods/:modId/submissions
  fastify.post('/v1/mods/:modId/submissions', { preHandler: authenticateApiKey }, async (request, reply) => {
    const db = getDB();
    const { modId } = request.params as { modId: string };

    const fields: Record<string, string> = {};
    let repackagedZipPath: string | null = null;

    // Fields arrive before the optional repackaged_zip file part
    for await (const part of request.parts()) {
      if (part.type === 'field') {
        fields[part.fieldname] = String(part.value);
      } else if (part.fieldname === 'repackaged_zip' && fields.verdict === 'REPACKAGE' && fields.task_id) {
        const uploadDir = path.join(process.cwd(), 'uploads', 'repackaged');
        await fs.mkdir(uploadDir, { recursive: true });
        repackagedZipPath = path.join(uploadDir, `${parseInt(fields.task_id)}_${Date.now()}.zip`);
        await pipeline(part.file, createWriteStream(repackagedZipPath));
      } else {
        part.file.resume();
      }
    }

    const { task_id: taskId, verdict, report } = fields;
    if (!taskId || !verdict || !report) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Missing required fields: task_id, verdict, report' });
    }

    const task = await db('queue_tasks').where({ id: taskId }).first();
    if (!task) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }
    if (task.status !== 'claimed') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Task not claimed or already processed' });
    }
    if (task.mod_id !== parseInt(modId)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Task does not belong to this mod' });
    }

    try {
      let repackagedChecksum: string | null = null;
      if (repackagedZipPath) {
        const hash = crypto.createHash('sha256');
        await pipeline(createReadStream(repackagedZipPath), hash);
        repackagedChecksum = hash.digest('hex');
      }

      const result = {
        verdict,
        report: JSON.parse(report),
        signature_blob: fields.signature_blob ? JSON.parse(fields.signature_blob) : null,
        comment_draft: fields.comment_draft ?? null,
        repackaged_zip_path: repackagedZipPath,
        repackaged_checksum: repackagedChecksum,
      };

      // Signed state stays sourced from mod.io sync; the result is kept on the task for review
      await db('queue_tasks').where({ id: taskId }).update({
        status: 'completed',
        result: JSON.stringify(result),
        completed_at: new Date(),
        updated_at: new Date(),
      });

      return { success: true, task_id: taskId };
    } catch (error: any) {
      await db('queue_tasks').where({ id: taskId }).update({
        status: 'failed',
        error: error.message,
        updated_at: new Date(),
      });
      return reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });
};

export default queuePlugin;
