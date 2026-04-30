/*
  EmailJob: queued email deliveries
*/
const Base = require('../ketidaBase')

const { id, stringNotEmpty, email, integerPositive, string } =
  require('../helpers').schema

class EmailJob extends Base {
  constructor(properties) {
    super(properties)
    this.type = 'emailJob'
  }

  static get tableName() {
    return 'email_jobs'
  }

  static get schema() {
    return {
      type: 'object',
      properties: {
        to: email,
        subject: stringNotEmpty,
        text: stringNotEmpty,
        content: stringNotEmpty,
        status: stringNotEmpty,
        attempts: { type: "integer", minimum: 0 },
        lastError: string,
        scheduledAt: string,
        lockedAt: string,
        sentAt: string,
      },
    }
  }
}

module.exports = EmailJob
