const { BaseModel } = require('@coko/server')
const { id, stringNotEmpty } = require('../helpers').schema

class InstanceMetric extends BaseModel {
  constructor(properties) {
    super(properties)
    this.type = 'instance_metric'
  }

  static get tableName() {
    return 'instance_metrics'
  }

  static get schema() {
    return {
      type: 'object',
      required: ['service', 'status', 'isHealthy', 'capturedAt'],
      properties: {
        id,
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        service: stringNotEmpty,
        url: { type: ['string', 'null'] },
        status: stringNotEmpty,
        isHealthy: { type: 'boolean' },
        statusCode: { type: ['integer', 'null'] },
        latencyMs: { type: ['integer', 'null'] },
        message: { type: ['string', 'null'] },
        cpuLoad1: { type: ['number', 'null'] },
        cpuLoad5: { type: ['number', 'null'] },
        cpuLoad15: { type: ['number', 'null'] },
        memoryUsedMb: { type: ['number', 'null'] },
        memoryTotalMb: { type: ['number', 'null'] },
        capturedAt: { type: 'string', format: 'date-time' },
      },
    }
  }
}

module.exports = InstanceMetric
