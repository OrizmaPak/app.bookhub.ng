const { logger } = require('@coko/server')

exports.up = async knex => {
  try {
    await knex.schema.table('template', table => {
      table.text('scope').notNullable().defaultTo('global')
      table.uuid('book_id').nullable()
      table.uuid('export_profile_id').nullable()
      table.uuid('created_by').nullable()

      table.index(['scope'])
      table.index(['book_id'])
      table.index(['export_profile_id'])
    })
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: Template: add designer template scope failed')
  }
}

exports.down = async knex => {
  try {
    await knex.schema.table('template', table => {
      table.dropIndex(['export_profile_id'])
      table.dropIndex(['book_id'])
      table.dropIndex(['scope'])

      table.dropColumn('created_by')
      table.dropColumn('export_profile_id')
      table.dropColumn('book_id')
      table.dropColumn('scope')
    })
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: Template: remove designer template scope failed')
  }
}
