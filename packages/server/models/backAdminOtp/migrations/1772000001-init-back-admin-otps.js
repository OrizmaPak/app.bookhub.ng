const { logger } = require('@coko/server')

exports.up = knex => {
  try {
    return knex.schema.createTable('back_admin_otps', table => {
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
      table.text('email').notNullable()
      table.text('codeHash').notNullable()
      table.timestamp('expiresAt', { useTz: true }).notNullable()
      table.timestamp('consumedAt', { useTz: true }).nullable()
      table.integer('attempts').notNullable().defaultTo(0)
      table.index(['email'])
      table.index(['expiresAt'])
    })
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: Back admin OTPs: initial migration failed')
  }
}

exports.down = knex => knex.schema.dropTable('back_admin_otps')
