import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('queue_tasks', (table) => {
    table.string('review_status', 20).nullable().comment('published | commented | dismissed');
    table.integer('published_file_id').unsigned().nullable().comment('mod.io file id of the signed upload');
    table.timestamp('reviewed_at').nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('queue_tasks', (table) => {
    table.dropColumn('review_status');
    table.dropColumn('published_file_id');
    table.dropColumn('reviewed_at');
  });
}
