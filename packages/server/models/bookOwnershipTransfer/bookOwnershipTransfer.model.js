const Base = require('../ketidaBase')
const { id, string } = require('../helpers').schema

class BookOwnershipTransfer extends Base {
  constructor(properties) {
    super(properties)
    this.type = 'bookOwnershipTransfer'
  }

  static get tableName() {
    return 'book_ownership_transfers'
  }

  static get schema() {
    return {
      type: 'object',
      required: ['bookId', 'fromUserId', 'toUserId', 'transferredByUserId', 'status'],
      properties: {
        bookId: id,
        fromUserId: id,
        toUserId: id,
        transferredByUserId: id,
        status: string,
        reason: string,
        revokeReason: string,
        revokedByUserId: id,
        revokedAt: string,
        metadata: {
          type: ['object', 'null'],
          default: {},
        },
      },
    }
  }
}

module.exports = BookOwnershipTransfer
