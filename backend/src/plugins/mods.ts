import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getDB } from '../database/db.js';
import { authenticateJWT } from '../middleware/auth.js';

export default async function modsRoutes(fastify: FastifyInstance) {
  // Register routes under /mods prefix
  await fastify.register(async (modsScope) => {
    // All mods routes require JWT authentication
    modsScope.addHook('preHandler', authenticateJWT);

    /**
     * GET /api/mods
     * List mods with role-based filtering
     * - mod_signer: sees unsigned mods only
     * - admin: sees all mods
     */
    modsScope.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const db = getDB();
      const { role } = request.user!;
      const { outdated } = (request.query as { outdated?: string }) || {};

      // Base query joining mods with their current version
      let query = db('mods')
        .leftJoin('mod_versions', function () {
          this.on('mods.id', '=', 'mod_versions.mod_id').andOn(
            'mod_versions.is_current',
            '=',
            db.raw('?', [true])
          );
        })
        .select(
          'mods.id',
          'mods.name',
          'mods.status',
          'mods.last_uploaded_at',
          'mods.mod_io_url',
          'mods.mod_io_id',
          'mod_versions.version as latest_version',
          'mod_versions.is_signed',
          'mod_versions.filesize',
          'mod_versions.uploaded_at as version_uploaded_at'
        );

      // Both mod_signers and admins see all mods
      const mods = await query.orderBy('mods.last_uploaded_at', 'desc');

      // Enrich with counts, current and latest versions
      let modsWithCounts = await Promise.all(
        mods.map(async (mod) => {
          const versionsQ = db('mod_versions').where({ mod_id: mod.id });

          const [versionCountRow, currentVersionRow, latestVersionRow] = await Promise.all([
            versionsQ.clone().count('* as count').first(),
            versionsQ.clone().where({ is_current: true }).select('version', 'is_signed', 'uploaded_at').first(),
            versionsQ.clone().orderBy('uploaded_at', 'desc').select('version', 'is_signed', 'uploaded_at').first(),
          ]);

          const version_count = versionCountRow?.count ? Number(versionCountRow.count) : 0;

          return {
            ...mod,
            version_count,
            current_version: currentVersionRow?.version || null,
            current_signed: currentVersionRow?.is_signed ?? null,
            latest_version: latestVersionRow?.version || null,
            latest_signed: latestVersionRow?.is_signed ?? null,
          };
        })
      );

      // Apply outdated filter if requested
      if (String(outdated).toLowerCase() === 'true') {
        modsWithCounts = modsWithCounts.filter(m => !!m.latest_version && !!m.current_version && m.latest_version !== m.current_version);
      }

      return reply.status(200).send({
        mods: modsWithCounts,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch mods');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch mods',
      });
    }
  });

    /**
     * GET /api/mods/:id/versions
     * Get all versions of a specific mod
     */
    modsScope.get('/:id/versions', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const modId = parseInt(id, 10);

    if (isNaN(modId)) {
      return reply.status(400).send({
        error: 'Validation Error',
        message: 'Invalid mod ID',
      });
    }

    try {
      const db = getDB();

      // Check if mod exists
      const mod = await db('mods').where({ id: modId }).first();
      if (!mod) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Mod not found',
        });
      }

      // Get all versions
      const versions = await db('mod_versions')
        .where({ mod_id: modId })
        .select('*')
        .orderBy('uploaded_at', 'desc');

      return reply.status(200).send({
        mod: {
          id: mod.id,
          name: mod.name,
          mod_io_id: mod.mod_io_id,
          mod_io_url: mod.mod_io_url,
        },
        versions,
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to fetch mod versions');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch mod versions',
      });
    }
  });
  }, { prefix: '/mods' });
}
