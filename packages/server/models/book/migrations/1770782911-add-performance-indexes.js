const { logger } = require('@coko/server')

const ensureIndex = async (knex, table, column, indexName) => {
  const hasTable = await knex.schema.hasTable(table)
  if (!hasTable) return
  const hasColumn = await knex.schema.hasColumn(table, column)
  if (!hasColumn) return
  await knex.raw(`CREATE INDEX IF NOT EXISTS ${indexName} ON "${table}" ("${column}")`)
}

exports.up = async knex => {
  try {
    await ensureIndex(knex, 'BookComponent', 'bookId', 'idx_bookcomponent_bookid')
    await ensureIndex(knex, 'BookComponent', 'divisionId', 'idx_bookcomponent_divisionid')
    await ensureIndex(knex, 'BookComponentTranslation', 'bookComponentId', 'idx_bookcomponenttranslation_componentid')
    await ensureIndex(knex, 'BookComponentState', 'bookComponentId', 'idx_bookcomponentstate_componentid')
    await ensureIndex(knex, 'Lock', 'foreignId', 'idx_lock_foreignid')
    await ensureIndex(knex, 'Invitations', 'bookId', 'idx_invitations_bookid')
    await ensureIndex(knex, 'Invitations', 'email', 'idx_invitations_email')
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: performance indexes failed')
  }
}

exports.down = async knex => {
  await knex.raw('DROP INDEX IF EXISTS idx_bookcomponent_bookid')
  await knex.raw('DROP INDEX IF EXISTS idx_bookcomponent_divisionid')
  await knex.raw('DROP INDEX IF EXISTS idx_bookcomponenttranslation_componentid')
  await knex.raw('DROP INDEX IF EXISTS idx_bookcomponentstate_componentid')
  await knex.raw('DROP INDEX IF EXISTS idx_lock_foreignid')
  await knex.raw('DROP INDEX IF EXISTS idx_invitations_bookid')
  await knex.raw('DROP INDEX IF EXISTS idx_invitations_email')
}
