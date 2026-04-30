const { logger } = require('@coko/server')

exports.up = knex => {
  try {
    return knex.schema.createTable('email_jobs', table => {
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
      table.text('to').notNullable()
      table.text('subject').notNullable()
      table.text('text').notNullable()
      table.text('content').notNullable()
      table.text('status').notNullable().defaultTo('pending')
      table.integer('attempts').notNullable().defaultTo(0)
      table.text('lastError').nullable()
      table.timestamp('scheduledAt', { useTz: true }).nullable()
      table.timestamp('lockedAt', { useTz: true }).nullable()
      table.timestamp('sentAt', { useTz: true }).nullable()
      table.index(['status'])
      table.index(['lockedAt'])
      table.index(['scheduledAt'])
    })
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: Email jobs: initial migration failed')
  }
}

exports.down = knex => knex.schema.dropTable('email_jobs')
