import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Users table
  await knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table.string('email_hash', 64).notNullable().unique().comment('HMAC-SHA256 hashed email');
    table.string('password_hash', 255).notNullable().comment('Argon2 hashed password');
    table.enum('role', ['mod_signer', 'admin']).notNullable().defaultTo('mod_signer');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
    
    table.index('email_hash');
    table.index('role');
  });

  // Mods table
  await knex.schema.createTable('mods', (table) => {
    table.increments('id').primary();
    table.integer('mod_io_id').notNullable().unique().comment('mod.io unique ID');
    table.string('name', 255).notNullable();
    table.timestamp('last_uploaded_at').nullable().comment('Last upload timestamp from mod.io');
    table.string('mod_io_url', 512).notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    table.index('mod_io_id');
    table.index('name');
  });

  // Mod versions table
  await knex.schema.createTable('mod_versions', (table) => {
    table.increments('id').primary();
    table.integer('mod_id').unsigned().notNullable().references('id').inTable('mods').onDelete('CASCADE');
    table.string('version', 100).notNullable();
    table.boolean('is_signed').notNullable().defaultTo(false).comment('Approval status from mod.io');
    table.timestamp('uploaded_at').notNullable().comment('Upload timestamp from mod.io');
    table.boolean('is_current').notNullable().defaultTo(false).comment('Is this the latest version?');
    table.string('md5', 32).notNullable().comment('MD5 hash for change detection');
    table.integer('filesize').unsigned().notNullable();
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    
    table.index('mod_id');
    table.index('is_current');
    table.index(['mod_id', 'version']);
    table.unique(['mod_id', 'md5']); // Prevent duplicate versions
  });

  // Audit logs table
  await knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL');
    table.string('action', 100).notNullable().comment('CREATE_USER, DELETE_USER, REGENERATE_KEY, etc.');
    table.string('resource', 255).nullable().comment('Target resource ID');
    table.string('ip_address', 45).notNullable();
    table.string('user_agent', 512).nullable();
    table.timestamp('timestamp').notNullable().defaultTo(knex.fn.now());
    
    table.index('user_id');
    table.index('action');
    table.index('timestamp');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('audit_logs');
  await knex.schema.dropTableIfExists('mod_versions');
  await knex.schema.dropTableIfExists('mods');
  await knex.schema.dropTableIfExists('users');
}
