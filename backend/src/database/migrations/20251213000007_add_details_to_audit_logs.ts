import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('audit_logs', 'details');
  if (!hasColumn) {
    await knex.schema.alterTable('audit_logs', (table) => {
      table.text('details').nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema.hasColumn('audit_logs', 'details');
  if (hasColumn) {
    await knex.schema.alterTable('audit_logs', (table) => {
      table.dropColumn('details');
    });
  }
}
