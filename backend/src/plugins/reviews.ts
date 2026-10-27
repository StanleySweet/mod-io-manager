import { FastifyPluginAsync, FastifyBaseLogger } from 'fastify';
import { authenticateApiKey } from '../middleware/apiKey.js';
import { getDB } from '../database/db.js';
import { verifyMinisig } from '../utils/minisign.js';
import crypto from 'crypto';

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

const reviewsPlugin: FastifyPluginAsync = async (fastify) => {
  // GET /api/v1/reviews - audited tasks waiting for a human decision
  fastify.get('/v1/reviews', { preHandler: authenticateApiKey }, async () => {
    const db = getDB();
    const tasks = await db('queue_tasks')
      .where({ status: 'completed' })
      .where((q) => q.whereNull('review_status').orWhere('review_status', 'publish_failed'))
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
