import type { Knex } from 'knex';

// SQLite does not support dropping columns directly; we recreate the table without IP address
export async function up(knex: Knex): Promise<void> {
  // Create new table without ip_address
  await knex.schema.createTable('audit_logs_new', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('resource', 255).nullable();
    table.string('user_agent', 512).nullable();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('action');
    table.index('timestamp');
  });

  // Copy data (excluding ip_address)
  await knex.raw(`INSERT INTO audit_logs_new (id, user_id, action, resource, user_agent, timestamp)
                  SELECT id, user_id, action, resource, user_agent, timestamp FROM audit_logs`);

  // Drop old table and rename new
  await knex.schema.dropTable('audit_logs');
  await knex.schema.renameTable('audit_logs_new', 'audit_logs');
}

export async function down(knex: Knex): Promise<void> {
  // Recreate original table with ip_address (best-effort rollback)
  await knex.schema.createTable('audit_logs_old', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('resource', 255).nullable();
    table.string('ip_address', 45).notNullable();
    table.string('user_agent', 512).nullable();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());

    table.index('user_id');
    table.index('action');
    table.index('timestamp');
  });

  // Copy data adding placeholder IP
  await knex.raw(`INSERT INTO audit_logs_old (id, user_id, action, resource, ip_address, user_agent, timestamp)
                  SELECT id, user_id, action, resource, '0.0.0.0', user_agent, timestamp FROM audit_logs`);

  await knex.schema.dropTable('audit_logs');
  await knex.schema.renameTable('audit_logs_old', 'audit_logs');
}
