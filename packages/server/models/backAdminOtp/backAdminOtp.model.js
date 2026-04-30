const { BaseModel } = require('@coko/server')
const { id, stringNotEmpty } = require('../helpers').schema

class BackAdminOtp extends BaseModel {
  constructor(properties) {
    super(properties)
    this.type = 'back_admin_otp'
  }

  static get tableName() {
    return 'back_admin_otps'
  }

  static get schema() {
    return {
      type: 'object',
      required: ['email', 'codeHash', 'expiresAt'],
      properties: {
        id,
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        email: stringNotEmpty,
        codeHash: stringNotEmpty,
        expiresAt: { type: 'string', format: 'date-time' },
        consumedAt: { type: ['string', 'null'], format: 'date-time' },
        attempts: { type: 'integer', minimum: 0 },
      },
    }
  }
}

module.exports = BackAdminOtp
