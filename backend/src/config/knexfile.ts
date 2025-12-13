import type { Knex } from 'knex';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || join(__dirname, '..', '..', 'data', 'modio.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: join(__dirname, '..', 'database', 'migrations'),
      extension: 'ts',
      loadExtensions: ['.ts'],
    },
    pool: {
      afterCreate: (conn: any, cb: any) => {
        // Enable WAL mode for better concurrency
        conn.pragma('journal_mode = WAL');
        // Enable foreign keys
        conn.pragma('foreign_keys = ON');
        cb();
      },
    },
  },
  production: {
    client: 'better-sqlite3',
    connection: {
      filename: process.env.DATABASE_PATH || join(__dirname, '..', '..', 'data', 'modio.db'),
    },
    useNullAsDefault: true,
    migrations: {
      directory: join(__dirname, '..', 'database', 'migrations'),
      extension: 'js',
      loadExtensions: ['.js'],
    },
    pool: {
      afterCreate: (conn: any, cb: any) => {
        conn.pragma('journal_mode = WAL');
        conn.pragma('foreign_keys = ON');
        cb();
      },
    },
  },
};

export default config;
