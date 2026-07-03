const seedAdmin = async () => {
  /* eslint-disable global-require */
  const { logger, useTransaction, Identity } = require('@coko/server')
  const userData = require('config').get('admin')

  const Team = require('../../models/team/team.model')
  const User = require('../../models/user/user.model')
  /* eslint-enable global-require */

  try {
    const { username, password, email, givenNames, surname } = userData

    return useTransaction(async trx => {
      let adminUser
      logger.info(
        '>>> Checking if admin user with provided email and username already exists...',
      )

      const usernameUser = await User.findOne({ username }, { trx })
      const emailIdentity = await Identity.findOne({ email }, { trx })

      const existingUsers = []

      if (usernameUser) {
        existingUsers.push(usernameUser)
      }

      if (emailIdentity && emailIdentity.userId !== usernameUser?.id) {
        const emailUser = await User.findById(emailIdentity.userId, { trx })

        if (emailUser) {
          existingUsers.push(emailUser)
        }
      }

      if (existingUsers.length !== 0) {
        await Promise.all(
          existingUsers.map(async user => {
            const isAdmin = await User.hasGlobalRole(user.id, 'admin', { trx })

            if (isAdmin) {
              logger.warn(
                '>>> An admin user with these credentials already exists in the system',
              )
              return false
            }

            if (user.username === username && user.email && user.email !== email) {
              logger.warn(
                `>>> Username "${username}" already exists with a different email (${user.email}). Reusing existing user and skipping email reassignment.`,
              )
            } else if (user.email === email && user.username !== username) {
              logger.warn(
                `>>> Email "${email}" already exists on username "${user.username}". Reusing existing user and skipping username creation.`,
              )
            }

            logger.warn(
              '>>> User already exists but will be added in the Admins team',
            )
            adminUser = user
            return Team.addMemberToGlobalTeam(user.id, 'admin', { trx })
          }),
        )
      } else {
        logger.info('creating user')

        const newAdminUser = await User.insert(
          {
            password,
            givenNames,
            surname,
            agreedTc: true,
            isActive: true,
            username,
          },
          { trx },
        )

        await Identity.insert(
          {
            userId: newAdminUser.id,
            isDefault: true,
            isVerified: true,
            email,
          },
          { trx },
        )

        await Team.addMemberToGlobalTeam(newAdminUser.id, 'admin', { trx })

        logger.info(
          `>>> admin user  with username "${username}" successfully created.`,
        )
        adminUser = newAdminUser
        return newAdminUser
      }

      return adminUser
    })
  } catch (e) {
    logger.error(e.message)
    throw new Error(e)
  }
}

module.exports = seedAdmin
