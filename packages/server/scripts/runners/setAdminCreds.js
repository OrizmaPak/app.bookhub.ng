#!/usr/bin/env node
/* Update or create the admin user from env (config.admin) without failing on existing records */
const { logger, useTransaction, Identity } = require('@coko/server')
const cfg = require('config')
const Team = require('../../models/team/team.model')
const User = require('../../models/user/user.model')

const run = async () => {
  const userData = cfg.get('admin')
  const { username, password, email, givenNames, surname } = userData
  return useTransaction(async trx => {
    let user = await User.query(trx).findOne({ username })
    if (!user) {
      logger.info('Admin not found — creating new admin user')
      user = await User.insert(
        {
          username,
          password,
          givenNames,
          surname,
          agreedTc: true,
          isActive: true,
        },
        { trx }
      )
    } else {
      logger.info('Admin exists — updating password/profile/email and ensuring admin team membership')
      user = await User.query(trx)
        .patchAndFetchById(user.id, { password, givenNames, surname })
      const defaultIdentity = await Identity.query(trx)
        .findOne({ userId: user.id, isDefault: true })
      if (defaultIdentity) {
        await Identity.query(trx)
          .patch({ email, isVerified: true })
          .where({ id: defaultIdentity.id })
      } else {
        await Identity.insert({ userId: user.id, isDefault: true, isVerified: true, email }, { trx })
      }
    }
    // ensure admin team membership
    const isAdmin = await User.hasGlobalRole(user.id, 'admin', { trx })
    if (!isAdmin) await Team.addMemberToGlobalTeam(user.id, 'admin', { trx })
    logger.info('Admin credentials applied successfully')
  })
}

run().catch(err => {
  logger.error(err)
  process.exit(1)
})
