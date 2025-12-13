import 'dotenv/config';
import Fastify from 'fastify';
import autoLoad from '@fastify/autoload';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getDB, closeDB } from './database/db.js';
import { startModioScheduler } from './services/modioSync.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const start = async () => {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
    trustProxy: true,
  });

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  // CORS — replicate replay-pallas-api behavior (permissive)
  await fastify.register(cors, {
    origin: '*',
    allowedHeaders: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    preflight: true,
    strictPreflight: false,
    hook: 'onRequest',
  });

  // Fast path for OPTIONS preflight like replay-pallas-api
  fastify.addHook('preHandler', (req, res, done) => {
    if (/options/i.test(req.method)) {
      res.send();
      return;
    }
    done();
  });

  // Global rate limiting
  await fastify.register(rateLimit, {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    timeWindow: parseInt(process.env.RATE_LIMIT_TIMEWINDOW || '60000'),
  });

  // Auto-load plugins from src/plugins
  await fastify.register(autoLoad, {
    dir: join(__dirname, 'plugins'),
    options: Object.assign({}, { prefix: '/api' }),
  });

  // Database connection check
  fastify.addHook('onReady', async () => {
    try {
      const db = getDB();
      
      // Run migrations automatically
      fastify.log.info('Running database migrations...');
      await db.migrate.latest();
      fastify.log.info('Database migrations completed');
      
      await db.raw('SELECT 1');
      fastify.log.info('Database connection successful');

      // Start mod.io polling scheduler
      startModioScheduler(fastify.log);
    } catch (err) {
      fastify.log.error({ err }, 'Database connection failed');
      throw err;
    }
  });

  // Graceful shutdown
  const closeGracefully = async (signal: string) => {
    fastify.log.info(`Received ${signal}, closing gracefully`);
    await fastify.close();
    await closeDB();
    process.exit(0);
  };

  process.on('SIGINT', () => closeGracefully('SIGINT'));
  process.on('SIGTERM', () => closeGracefully('SIGTERM'));

  // Start server
  try {
    const port = parseInt(process.env.PORT || '3000');
    const host = process.env.HOST || '0.0.0.0';
    
    await fastify.listen({ port, host });
    fastify.log.info(`Server listening on ${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
