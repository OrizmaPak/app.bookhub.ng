const { logger } = require('@coko/server')

const ensureIndex = async (knex, table, column, indexName) => {
  const hasTable = await knex.schema.hasTable(table)
  if (!hasTable) return
  const hasColumn = await knex.schema.hasColumn(table, column)
  if (!hasColumn) return
  await knex.raw(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} (${column})`)
}

exports.up = async knex => {
  try {
    await ensureIndex(knex, 'book_component', 'book_id', 'idx_book_component_book_id')
    await ensureIndex(knex, 'book_component', 'division_id', 'idx_book_component_division_id')
    await ensureIndex(knex, 'book_component_state', 'book_component_id', 'idx_book_component_state_component_id')
    await ensureIndex(knex, 'lock', 'foreign_id', 'idx_lock_foreign_id')
    await ensureIndex(knex, 'lock', 'foreign_type', 'idx_lock_foreign_type')
    await ensureIndex(knex, 'invitations', 'book_id', 'idx_invitations_book_id')
    await ensureIndex(knex, 'invitations', 'email', 'idx_invitations_email')
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: performance indexes v2 failed')
  }
}

exports.down = async knex => {
  await knex.raw('DROP INDEX IF EXISTS idx_book_component_book_id')
  await knex.raw('DROP INDEX IF EXISTS idx_book_component_division_id')
  await knex.raw('DROP INDEX IF EXISTS idx_book_component_state_component_id')
  await knex.raw('DROP INDEX IF EXISTS idx_lock_foreign_id')
  await knex.raw('DROP INDEX IF EXISTS idx_lock_foreign_type')
  await knex.raw('DROP INDEX IF EXISTS idx_invitations_book_id')
  await knex.raw('DROP INDEX IF EXISTS idx_invitations_email')
}
