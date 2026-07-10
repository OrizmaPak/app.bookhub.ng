const { logger } = require('@coko/server')
const Identity = require('@coko/server/src/models/identity/identity.model')

const {
  searchForUsers,
  isAdmin,
  ketidaLogin,
  ketidaResendVerificationEmail,
  isGlobal,
} = require('../../../controllers/user.controller')

const searchForUsersHandler = async (
  _,
  { search, exclude, exactMatch },
  ctx,
  info,
) => {
  try {
    logger.info('user resolver: executing searchForUsers use case')

    return searchForUsers(search, exclude, exactMatch)
  } catch (e) {
    throw new Error(e)
  }
}

const ketidaLoginHandler = async (_, { input }) => {
  try {
    return ketidaLogin(input)
  } catch (e) {
    throw new Error(e.message)
  }
}

const ketidaRequestVerificationEmailHandler = async (_, { email }) => {
  try {
    logger.info(`[USER RESOLVER] - ketidaResendVerificationEmail`)
    return ketidaResendVerificationEmail(email)
  } catch (e) {
    logger.error(
      `[USER RESOLVER] - ketidaResendVerificationEmail: ${e.message}`,
    )
    throw new Error(e)
  }
}

module.exports = {
  Mutation: {
    searchForUsers: searchForUsersHandler,
    ketidaLogin: ketidaLoginHandler,
    ketidaRequestVerificationEmail: ketidaRequestVerificationEmailHandler,
  },
  User: {
    async admin(user) {
      logger.info('in custom resolver')
      return isAdmin(user.id)
    },
    async email(user) {
      if (user.email) return user.email
      if (user.defaultIdentity?.email) return user.defaultIdentity.email
      if (!user.id) return null

      const identity = await Identity.query()
        .where('user_id', user.id)
        .where('is_default', true)
        .first()

      return identity?.email || null
    },
    async isGlobal(user) {
      logger.info('isGlobal resolver')
      return isGlobal(user.id)
    },
  },
}
