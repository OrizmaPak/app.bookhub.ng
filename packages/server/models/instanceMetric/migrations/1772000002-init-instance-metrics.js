const { logger } = require('@coko/server')

exports.up = knex => {
  try {
    return knex.schema.createTable('instance_metrics', table => {
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
      table.text('service').notNullable()
      table.text('url').nullable()
      table.text('status').notNullable()
      table.boolean('isHealthy').notNullable().defaultTo(false)
      table.integer('statusCode').nullable()
      table.integer('latencyMs').nullable()
      table.text('message').nullable()
      table.float('cpuLoad1').nullable()
      table.float('cpuLoad5').nullable()
      table.float('cpuLoad15').nullable()
      table.float('memoryUsedMb').nullable()
      table.float('memoryTotalMb').nullable()
      table.timestamp('capturedAt', { useTz: true }).notNullable()
      table.index(['service'])
      table.index(['capturedAt'])
      table.index(['isHealthy'])
    })
  } catch (e) {
    logger.error(e)
    throw new Error('Migration: Instance metrics: initial migration failed')
  }
}

exports.down = knex => knex.schema.dropTable('instance_metrics')
