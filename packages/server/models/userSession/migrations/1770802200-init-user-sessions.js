const { logger } = require('@coko/server')

exports.up = knex => {
  try {
    return knex.schema.createTable('user_sessions', table => {
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
      table.uuid('userId').notNullable()
      table.text('token').notNullable()
      table.timestamp('revokedAt', { useTz: true }).nullable()
      table.index(['userId'])
      table.index(['token'])
      table.unique(['token'])
    })
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: User sessions: initial migration failed')
  }
}

exports.down = knex => knex.schema.dropTable('user_sessions')
