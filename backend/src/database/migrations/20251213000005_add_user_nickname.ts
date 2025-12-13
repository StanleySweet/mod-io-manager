import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('users', 'nickname');
  if (!hasColumn) {
    // 1) Add column as nullable (SQLite cannot add NOT NULL without default)
    await knex.schema.alterTable('users', (table) => {
      table.string('nickname');
    });

    // 2) Backfill existing rows with a generated nickname
    await knex('users').update({ nickname: knex.raw("'user_' || id") }).whereNull('nickname');

    // Prefer nickname 'admin' for the first admin user if present
    try {
      const admin = await knex('users').where({ role: 'admin' }).orderBy('id', 'asc').first();
      if (admin) {
        await knex('users')
          .where({ id: admin.id })
          .update({ nickname: 'admin' });
      }
    } catch (e) {
      // ignore if any constraint issues occur; unique index not yet applied
    }

    // 3) Create a unique index on nickname to enforce uniqueness
    await knex.schema.alterTable('users', (table) => {
      table.unique(['nickname']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('users', 'nickname');
  if (hasColumn) {
    await knex.schema.alterTable('users', (table) => {
      table.dropUnique(['nickname']);
      table.dropColumn('nickname');
    });
  }
}
