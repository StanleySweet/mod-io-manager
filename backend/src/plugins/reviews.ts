import { FastifyPluginAsync, FastifyBaseLogger } from 'fastify';
import multipart from '@fastify/multipart';
import { authenticateApiKey } from '../middleware/apiKey.js';
import { getDB } from '../database/db.js';
import { verifyMinisig } from '../utils/minisign.js';
import crypto from 'crypto';
import fs from 'fs/promises';
import { createWriteStream, openAsBlob } from 'fs';
import path from 'path';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

const modioBase = () => process.env.MODIO_BASE_URL || 'https://g-5.modapi.io/v1';
const modioGame = () => process.env.MODIO_GAME_ID || '5';

function modioHeaders(): Record<string, string> {
  const token = process.env.MODIO_OAUTH_TOKEN;
  if (!token) {
    throw new Error('MODIO_OAUTH_TOKEN is not configured');
  }
  return { Authorization: `Bearer ${token}`, Accept: 'application/json' };
}

async function modioError(res: Response): Promise<Error> {
  const body = await res.text();
  return new Error(`mod.io ${res.status}: ${body.slice(0, 500)}`);
}

async function loadReview(taskId: string) {
  const db = getDB();
  const task = await db('queue_tasks').where({ id: taskId, status: 'completed' }).first();
  if (!task || !task.result) {
    return null;
  }
  const mod = await db('mods').where({ id: task.mod_id }).first();
  const modVersion = await db('mod_versions').where({ id: task.mod_version_id }).first();
  if (!mod || !modVersion) {
    return null;
  }
  return { task, mod, modVersion, result: JSON.parse(task.result) };
}

async function audit(action: string, resource: string, details: string) {
  await getDB()('audit_logs').insert({ user_id: null, action, resource, details, user_agent: 'modaudit-review' });
}

// Runs after the HTTP response: hashing an 800 MB modfile outlives the proxy timeout
async function signInPlace(log: FastifyBaseLogger, review: NonNullable<Awaited<ReturnType<typeof loadReview>>>, metadataBlob: string, minisigs: string[]) {
  const db = getDB();
  const { task, mod, modVersion } = review;
  const fileUrl = `${modioBase()}/games/${modioGame()}/mods/${mod.mod_io_id}/files/${modVersion.mod_io_file_id}`;
  try {
    // Re-hash the distributed bytes ourselves: never trust the client's signature target
    const res = await fetch(`${fileUrl}/download`);
    if (!res.ok || !res.body) {
      throw await modioError(res);
    }
    const sha256 = crypto.createHash('sha256');
    const blake = crypto.createHash('blake2b512');
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      sha256.update(chunk);
      blake.update(chunk);
    }
    const digest = sha256.digest('hex');
    if (digest !== String(review.result.report?.zip_sha256 ?? '').toLowerCase()) {
      throw new Error(`modfile on mod.io (sha256 ${digest}) is not the audited file`);
    }
    const fileHash = blake.digest();
    const keyIds = minisigs.map((sig) => verifyMinisig(sig, fileHash));

    const put = await fetch(fileUrl, {
      method: 'PUT',
      headers: { ...modioHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ metadata_blob: metadataBlob }),
    });
    if (!put.ok) {
      throw await modioError(put);
    }
    await db('queue_tasks').where({ id: task.id }).update({ review_status: 'published', published_file_id: modVersion.mod_io_file_id, reviewed_at: new Date(), error: null });
    await audit('MODIO_SIGNED', String(mod.mod_io_id), `Set metadata_blob on file ${modVersion.mod_io_file_id} for ${mod.name} ${modVersion.version} (sha256 ${digest}, keys ${keyIds.join(',')})`);
  } catch (error: any) {
    log.error({ err: error }, `Signing task ${task.id} on mod.io failed`);
    await db('queue_tasks').where({ id: task.id }).update({ review_status: 'publish_failed', error: error.message });
  }
}

// Runs after the HTTP response: uploading to mod.io outlives the proxy timeout
async function uploadRepackaged(log: FastifyBaseLogger, review: NonNullable<Awaited<ReturnType<typeof loadReview>>>, zipPath: string, metadataBlob: string, oldVersion: string, newVersion: string, added: number) {
  const db = getDB();
  const { task, mod } = review;
  const note = `Repackaged and signed by Wildfire Games: compiled with pyrogenesis -archivebuild (${added} compiled file${added !== 1 ? 's' : ''} added), mod.json version ${oldVersion} -> ${newVersion}. No other file was changed.`;
  try {
    const form = new FormData();
    form.append('filedata', await openAsBlob(zipPath), `${mod.name.replace(/[^A-Za-z0-9._-]+/g, '_')}-${newVersion}.zip`);
    form.append('version', newVersion);
    form.append('active', 'true');
    form.append('changelog', note);
    form.append('metadata_blob', metadataBlob);
    const res = await fetch(`${modioBase()}/games/${modioGame()}/mods/${mod.mod_io_id}/files`, { method: 'POST', headers: modioHeaders(), body: form });
    if (!res.ok) {
      throw await modioError(res);
    }
    const file = (await res.json()) as { id: number };
    await db('queue_tasks').where({ id: task.id }).update({ review_status: 'published', published_file_id: file.id, reviewed_at: new Date(), error: null });
    await audit('MODIO_REPACKAGED', String(mod.mod_io_id), `Uploaded repackaged file ${file.id} for ${mod.name} ${newVersion}`);

    // ADR 0006: the author is told the mod was rebuilt by WFG
    const comment = await fetch(`${modioBase()}/games/${modioGame()}/mods/${mod.mod_io_id}/comments`, {
      method: 'POST',
      headers: { ...modioHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ content: `${note} The mod was not packaged with -archivebuild-compress; please package future versions the same way.` }),
    });
    if (!comment.ok) {
      const err = await modioError(comment);
      await db('queue_tasks').where({ id: task.id }).update({ error: `file uploaded, comment failed: ${err.message}` });
    }
  } catch (error: any) {
    log.error({ err: error }, `Uploading repackaged task ${task.id} failed`);
    await db('queue_tasks').where({ id: task.id }).update({ review_status: 'publish_failed', error: error.message });
  } finally {
    await fs.rm(zipPath, { force: true });
  }
}

const reviewsPlugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(multipart, {
    limits: { fileSize: 1024 * 1024 * 1024, fieldSize: 1024 * 1024 }, // 1GB zip
  });

  // GET /api/v1/reviews - audited tasks waiting for a human decision
  fastify.get('/v1/reviews', { preHandler: authenticateApiKey }, async () => {
    const db = getDB();
    const tasks = await db('queue_tasks')
      .where({ status: 'completed' })
      .where((q) => q.whereNull('review_status').orWhere('review_status', 'publish_failed'))
      // OUTDATED / UNRELEASED: no key in use can sign them, nothing to decide
      .whereRaw("json_extract(result, '$.verdict') NOT IN ('OUTDATED', 'UNRELEASED')")
      .orderBy('id');

    const reviews = [];
    for (const task of tasks) {
      const review = await loadReview(String(task.id));
      if (!review) continue;
      const { result, mod, modVersion } = review;
      reviews.push({
        task_id: task.id,
        mod_id: task.mod_id,
        name: mod.name,
        mod_io_url: mod.mod_io_url,
        version: modVersion.version,
        download_url: `${modioBase()}/games/${modioGame()}/mods/${mod.mod_io_id}/files/${modVersion.mod_io_file_id}/download`,
        md5: modVersion.md5,
        filesize: modVersion.filesize,
        verdict: result.verdict,
        zip_sha256: result.report?.zip_sha256 ?? '',
        mod_json: result.report?.mod_json ?? {},
        findings: (result.report?.findings ?? []).map((f: any) => ({ code: f.code, severity: f.severity, file: f.file })),
        comment_draft: result.comment_draft ?? '',
        previous_error: task.review_status === 'publish_failed' ? task.error : null,
      });
    }
    return { reviews };
  });

  // POST /api/v1/reviews/:taskId/publish - {metadata_blob}; verified against the modfile, then set on mod.io
  fastify.post('/v1/reviews/:taskId/publish', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const { metadata_blob: metadataBlob } = (request.body ?? {}) as { metadata_blob?: string };
    const review = await loadReview(taskId);
    if (!review) {
      return reply.status(404).send({ error: 'Not Found', message: 'Review not found' });
    }
    if (review.result.verdict !== 'SIGN') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Only SIGN verdicts can be published' });
    }
    if (review.task.review_status && review.task.review_status !== 'publish_failed') {
      return reply.status(409).send({ error: 'Conflict', message: `Already ${review.task.review_status}` });
    }
    let blob: { dependencies?: unknown; minisigs?: unknown };
    try {
      blob = JSON.parse(String(metadataBlob));
    } catch {
      return reply.status(400).send({ error: 'Bad Request', message: 'metadata_blob is not valid JSON' });
    }
    if (!Array.isArray(blob.dependencies) || !Array.isArray(blob.minisigs) || blob.minisigs.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'metadata_blob needs dependencies and at least one minisig' });
    }

    await getDB()('queue_tasks').where({ id: review.task.id }).update({ review_status: 'publishing', error: null });
    await audit('MODIO_SIGN_APPROVED', String(review.mod.mod_io_id), `Approved signature for ${review.mod.name} ${review.modVersion.version}`);
    void signInPlace(request.log, review, String(metadataBlob), blob.minisigs.map(String));
    return reply.status(202).send({ status: 'publishing', task_id: review.task.id });
  });

  // POST /api/v1/reviews/:taskId/repackage - rebuilt zip + metadata_blob; verified, then uploaded as a new modfile
  fastify.post('/v1/reviews/:taskId/repackage', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const review = await loadReview(taskId);
    if (!review) {
      return reply.status(404).send({ error: 'Not Found', message: 'Review not found' });
    }
    if (review.result.verdict !== 'REPACKAGE') {
      return reply.status(400).send({ error: 'Bad Request', message: 'Only REPACKAGE verdicts can be repackaged' });
    }
    if (review.task.review_status && review.task.review_status !== 'publish_failed') {
      return reply.status(409).send({ error: 'Conflict', message: `Already ${review.task.review_status}` });
    }

    // Not os.tmpdir(): /tmp is RAM-backed on the server
    const dir = path.join(process.cwd(), 'uploads', 'repackaged');
    await fs.mkdir(dir, { recursive: true });
    const zipPath = path.join(dir, `${review.task.id}_${Date.now()}.zip`);
    const fields: Record<string, string> = {};
    let sha256 = '';
    let blake: Buffer | null = null;
    try {
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = String(part.value);
        } else if (part.fieldname === 'filedata') {
          const sha = crypto.createHash('sha256');
          const b2 = crypto.createHash('blake2b512');
          const tap = new Transform({ transform(chunk, _enc, cb) { sha.update(chunk); b2.update(chunk); cb(null, chunk); } });
          await pipeline(part.file, tap, createWriteStream(zipPath));
          if (part.file.truncated) {
            throw Object.assign(new Error('zip exceeds 1 GB'), { statusCode: 400 });
          }
          sha256 = sha.digest('hex');
          blake = b2.digest();
        } else {
          part.file.resume();
        }
      }

      const { metadata_blob: metadataBlob, old_version: oldVersion, new_version: newVersion, rebuilt_sha256: claimed } = fields;
      const added = parseInt(fields.added ?? '0', 10);
      if (!blake || !metadataBlob || !oldVersion || !newVersion || !claimed) {
        throw Object.assign(new Error('Need filedata, metadata_blob, old_version, new_version and rebuilt_sha256'), { statusCode: 400 });
      }
      if (sha256 !== claimed.toLowerCase()) {
        throw Object.assign(new Error('Uploaded zip does not match rebuilt_sha256'), { statusCode: 400 });
      }
      let blob: { dependencies?: unknown; minisigs?: unknown };
      try {
        blob = JSON.parse(metadataBlob);
      } catch {
        throw Object.assign(new Error('metadata_blob is not valid JSON'), { statusCode: 400 });
      }
      if (!Array.isArray(blob.dependencies) || !Array.isArray(blob.minisigs) || blob.minisigs.length === 0) {
        throw Object.assign(new Error('metadata_blob needs dependencies and at least one minisig'), { statusCode: 400 });
      }
      const keyIds = blob.minisigs.map((sig) => {
        try {
          return verifyMinisig(String(sig), blake!);
        } catch (e: any) {
          throw Object.assign(e, { statusCode: 400 });
        }
      });

      await getDB()('queue_tasks').where({ id: review.task.id }).update({ review_status: 'publishing', error: null });
      await audit('MODIO_REPACKAGE_APPROVED', String(review.mod.mod_io_id), `Approved repackaged upload for ${review.mod.name} ${oldVersion} -> ${newVersion} (original sha256 ${review.result.report?.zip_sha256}, rebuilt sha256 ${sha256}, keys ${keyIds.join(',')})`);
      void uploadRepackaged(request.log, review, zipPath, metadataBlob, oldVersion, newVersion, added);
      return reply.status(202).send({ status: 'publishing', task_id: review.task.id });
    } catch (error: any) {
      await fs.rm(zipPath, { force: true });
      return reply.status(error.statusCode ?? 500).send({ error: error.statusCode ? 'Bad Request' : 'Internal Server Error', message: error.message });
    }
  });

  // POST /api/v1/reviews/:taskId/comment - post the rule-based comment draft to mod.io
  fastify.post('/v1/reviews/:taskId/comment', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const review = await loadReview(taskId);
    if (!review) {
      return reply.status(404).send({ error: 'Not Found', message: 'Review not found' });
    }
    if (review.task.review_status) {
      return reply.status(409).send({ error: 'Conflict', message: `Already ${review.task.review_status}` });
    }
    const content = String(review.result.comment_draft ?? '').trim();
    if (!content) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No comment draft for this task' });
    }

    const res = await fetch(`${modioBase()}/games/${modioGame()}/mods/${review.mod.mod_io_id}/comments`, {
      method: 'POST',
      headers: { ...modioHeaders(), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ content }),
    });
    if (!res.ok) {
      const err = await modioError(res);
      request.log.error({ err }, `Posting comment for task ${taskId} failed`);
      return reply.status(502).send({ error: 'Bad Gateway', message: err.message });
    }
    await getDB()('queue_tasks').where({ id: review.task.id }).update({ review_status: 'commented', reviewed_at: new Date() });
    await audit('MODIO_COMMENT', String(review.mod.mod_io_id), `Posted ${review.result.verdict} comment for ${review.mod.name} ${review.modVersion.version}`);
    return { status: 'commented', task_id: review.task.id };
  });

  // POST /api/v1/reviews/:taskId/dismiss - close without writing to mod.io
  fastify.post('/v1/reviews/:taskId/dismiss', { preHandler: authenticateApiKey }, async (request, reply) => {
    const { taskId } = request.params as { taskId: string };
    const review = await loadReview(taskId);
    if (!review) {
      return reply.status(404).send({ error: 'Not Found', message: 'Review not found' });
    }
    await getDB()('queue_tasks').where({ id: review.task.id }).update({ review_status: 'dismissed', reviewed_at: new Date() });
    await audit('REVIEW_DISMISSED', String(review.mod.mod_io_id), `Dismissed ${review.result.verdict} for ${review.mod.name} ${review.modVersion.version}`);
    return { status: 'dismissed', task_id: review.task.id };
  });
};

export default reviewsPlugin;
