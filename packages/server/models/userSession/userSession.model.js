const { BaseModel } = require('@coko/server')
const { id, stringNotEmpty } = require('../helpers').schema

class UserSession extends BaseModel {
  constructor(properties) {
    super(properties)
    this.type = 'user_session'
  }

  static get tableName() {
    return 'user_sessions'
  }

  static get schema() {
    return {
      type: 'object',
      required: ['userId', 'token'],
      properties: {
        id,
        created: { type: 'string', format: 'date-time' },
        updated: { type: 'string', format: 'date-time' },
        userId: id,
        token: stringNotEmpty,
        revokedAt: { type: ['string', 'null'], format: 'date-time' },
      },
    }
  }
}

module.exports = UserSession
