const { logger } = require('@coko/server')

exports.up = async knex => {
  try {
    const exists = await knex.schema.hasTable('book_ownership_transfers')
    if (exists) return null

    return knex.schema.createTable('book_ownership_transfers', table => {
      table.uuid('id').primary()
      table.text('type').notNullable()
      table
        .timestamp('created', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table
        .timestamp('updated', { useTz: true })
        .notNullable()
        .defaultTo(knex.fn.now())
      table.boolean('deleted').notNullable().defaultTo(false)
      table.uuid('bookId').notNullable()
      table.uuid('fromUserId').notNullable()
      table.uuid('toUserId').notNullable()
      table.uuid('transferredByUserId').notNullable()
      table.text('status').notNullable().defaultTo('active')
      table.text('reason').nullable()
      table.text('revokeReason').nullable()
      table.uuid('revokedByUserId').nullable()
      table.timestamp('revokedAt', { useTz: true }).nullable()
      table.jsonb('metadata').notNullable().defaultTo('{}')
      table.index(['bookId'])
      table.index(['fromUserId'])
      table.index(['toUserId'])
      table.index(['status'])
      table.index(['created'])
    })
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: Book ownership transfers: initial migration failed')
  }
}

exports.down = knex => knex.schema.dropTableIfExists('book_ownership_transfers')
