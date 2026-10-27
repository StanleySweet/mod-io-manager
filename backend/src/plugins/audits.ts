import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDB } from '../database/db.js';
import { authenticateJWT } from '../middleware/auth.js';
import { requireModSigner } from '../middleware/requireRole.js';

const STATUSES = ['pending', 'claimed', 'completed', 'failed'];
const VERDICTS = ['SIGN', 'REFUSE', 'NEEDS_HUMAN', 'REPACKAGE'];

// Read inside SQLite: the list never pulls the multi-MB result into Node
const VERDICT_SQL = "json_extract(queue_tasks.result, '$.verdict')";
const FINDINGS_SQL = "json_array_length(json_extract(queue_tasks.result, '$.report.findings'))";

export default async function auditsRoutes(fastify: FastifyInstance) {
  // Register routes under /audits prefix
  await fastify.register(async (auditsScope) => {
    // Read-only; mod_signer and admin only
    auditsScope.addHook('preHandler', authenticateJWT);
    auditsScope.addHook('preHandler', requireModSigner);

    /**
     * GET /api/audits
     * List audit tasks, newest first. Optional ?status= and ?verdict= filters
     */
    auditsScope.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
      const { status, verdict } = (request.query as { status?: string; verdict?: string }) || {};

      if ((status && !STATUSES.includes(status)) || (verdict && !VERDICTS.includes(verdict))) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid status or verdict filter',
        });
      }

      try {
        const db = getDB();
        let query = db('queue_tasks')
          .join('mods', 'mods.id', 'queue_tasks.mod_id')
          .join('mod_versions', 'mod_versions.id', 'queue_tasks.mod_version_id')
          .select(
            'queue_tasks.id',
            'mods.name',
            'mods.mod_io_url',
            'mod_versions.version',
            'queue_tasks.status',
            db.raw(`${VERDICT_SQL} as verdict`),
            'queue_tasks.review_status',
            db.raw(`CASE WHEN queue_tasks.result IS NOT NULL THEN COALESCE(${FINDINGS_SQL}, 0) END as findings_count`),
            'queue_tasks.error',
            'queue_tasks.completed_at',
            'queue_tasks.reviewed_at'
          )
          .orderBy([
            { column: 'queue_tasks.created_at', order: 'desc' },
            { column: 'queue_tasks.id', order: 'desc' },
          ]);

        if (status) {
          query = query.where('queue_tasks.status', status);
        }
        if (verdict) {
          query = query.whereRaw(`${VERDICT_SQL} = ?`, [verdict]);
        }

        const audits = await query;
        return reply.status(200).send({ audits });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch audits');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch audits',
        });
      }
    });

    /**
     * GET /api/audits/:id
     * One audit task with its findings, stats and comment draft
     */
    auditsScope.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      if (!/^\d+$/.test(id)) {
        return reply.status(400).send({
          error: 'Validation Error',
          message: 'Invalid audit ID',
        });
      }

      try {
        const db = getDB();
        const row = await db('queue_tasks')
          .join('mods', 'mods.id', 'queue_tasks.mod_id')
          .join('mod_versions', 'mod_versions.id', 'queue_tasks.mod_version_id')
          .where('queue_tasks.id', Number(id))
          .select(
            'queue_tasks.id',
            'mods.name',
            'mods.mod_io_url',
            'mod_versions.version',
            'queue_tasks.status',
            'queue_tasks.result',
            'queue_tasks.review_status',
            'queue_tasks.error',
            'queue_tasks.completed_at',
            'queue_tasks.reviewed_at'
          )
          .first();

        if (!row) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Audit not found',
          });
        }

        const result = row.result ? JSON.parse(row.result) : null;
        const report = result?.report ?? {};

        return reply.status(200).send({
          id: row.id,
          name: row.name,
          mod_io_url: row.mod_io_url,
          version: row.version,
          status: row.status,
          verdict: result?.verdict ?? null,
          review_status: row.review_status,
          error: row.error,
          completed_at: row.completed_at,
          reviewed_at: row.reviewed_at,
          zip_sha256: report.zip_sha256 ?? null,
          mod_json: report.mod_json ?? null,
          stats: report.stats ?? null,
          findings: (report.findings ?? []).map((f: { code: string; severity: string; file: string; detail: string }) => ({
            code: f.code,
            severity: f.severity,
            file: f.file,
            detail: f.detail,
          })),
          comment_draft: result?.comment_draft ?? null,
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to fetch audit');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch audit',
        });
      }
    });
  }, { prefix: '/audits' });
}
