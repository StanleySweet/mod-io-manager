import knex, { Knex } from 'knex';
import config from '../config/knexfile.js';

const environment = process.env.NODE_ENV || 'development';
const knexConfig = config[environment];

// Singleton instance
let instance: Knex | null = null;

export function getDB(): Knex {
  if (!instance) {
    instance = knex(knexConfig);
  }
  return instance;
}

export async function closeDB(): Promise<void> {
  if (instance) {
    await instance.destroy();
    instance = null;
  }
}
