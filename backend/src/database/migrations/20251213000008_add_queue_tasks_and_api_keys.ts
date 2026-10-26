import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('api_keys', (table) => {
    table.increments('id').primary();
    table.string('name', 255).notNullable();
    table.string('key_hash', 255).notNullable().unique();
    table.string('role', 50).notNullable().defaultTo('queue_worker');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('last_used_at').nullable();
    table.timestamp('revoked_at').nullable();
    table.index('key_hash');
    table.index('role');
  });

  await knex.schema.createTable('queue_tasks', (table) => {
    table.increments('id').primary();
    table.integer('mod_id').unsigned().notNullable().references('id').inTable('mods').onDelete('CASCADE');
    table.integer('mod_version_id').unsigned().notNullable().references('id').inTable('mod_versions').onDelete('CASCADE');
    table.enu('task_type', ['audit', 'sign', 'audit_and_sign']).notNullable();
    table.enu('status', ['pending', 'claimed', 'completed', 'failed']).notNullable().defaultTo('pending');
    table.integer('priority').notNullable().defaultTo(0);
    table.json('payload').nullable();
    table.json('result').nullable();
    table.text('error').nullable();
    table.timestamp('claimed_at').nullable();
    table.integer('claimed_by').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('completed_at').nullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    table.index('status');
    table.index('mod_version_id');
    table.index(['status', 'priority', 'created_at']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('queue_tasks');
  await knex.schema.dropTableIfExists('api_keys');
}