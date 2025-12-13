import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // First, drop the old unique constraint on (mod_id, md5)
  await knex.schema.alterTable('mod_versions', (table) => {
    table.dropUnique(['mod_id', 'md5']);
  });
  
  // Then add new columns
  await knex.schema.alterTable('mod_versions', (table) => {
    table.integer('mod_io_file_id').unsigned().nullable().comment('mod.io file ID');
    table.string('checksum_hash', 64).nullable().comment('Full checksum hash from mod.io');
    table.text('signature').nullable().comment('Cryptographic signature if signed');
    
    table.index('mod_io_file_id');
    table.unique(['mod_id', 'mod_io_file_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('mod_versions', (table) => {
    table.dropUnique(['mod_id', 'mod_io_file_id']);
    table.dropColumn('mod_io_file_id');
    table.dropColumn('checksum_hash');
    table.dropColumn('signature');
    // Restore the old constraint
    table.unique(['mod_id', 'md5']);
  });
}
