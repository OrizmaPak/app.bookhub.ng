const { find } = require('lodash/find')

const getAuthToken = ctx => {
  const header =
    ctx?.req?.headers?.authorization ||
    ctx?.authorization ||
    ctx?.token ||
    ctx?.req?.headers?.Authorization

  if (!header || typeof header !== 'string') return null

  const parts = header.split(' ')

  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1]
  }

  return header
}

const upsertSession = async (userId, token) => {
  /* eslint-disable global-require */
  const UserSession = require('../../../models/userSession/userSession.model')
  /* eslint-enable global-require */

  const existing = await UserSession.query().where({ userId, token }).first()

  if (existing) {
    if (existing.revokedAt) return { valid: false, revoked: true }
    return { valid: true }
  }

  await UserSession.insert({
    userId,
    token,
  })

  return { valid: true, created: true }
}

const isSessionValid = async (userId, ctx) => {
  if (process.env.DISABLE_SESSION_CHECK === 'true') return true
  if (!ctx) return true

  const token = getAuthToken(ctx)
  if (!token) {
    if (!ctx.req && !ctx.request) return true
    return false
  }

  try {
    const { valid, revoked } = await upsertSession(userId, token)
    if (revoked) return false
    return valid
  } catch (e) {
    console.warn(`[SESSION] session check skipped: ${e.message}`)
    return true
  }
}

const isAuthenticated = async (userId, ctx) => {
  try {
    /* eslint-disable global-require */
    const User = require('../../../models/user/user.model')
    /* eslint-enable global-require */
    let user

    if (userId) {
      user = await User.findById(userId, {
        related: 'defaultIdentity',
      })
    }

    if (!user || !user.isActive || !user.defaultIdentity.isVerified) {
      return false
    }

    const sessionValid = await isSessionValid(userId, ctx)

    return sessionValid
  } catch (e) {
    throw new Error(e.message)
  }
}

const isAdmin = async userId => {
  try {
    /* eslint-disable global-require */
    const User = require('../../../models/user/user.model')
    /* eslint-enable global-require */

    const hasAdminTeamMembership = await User.hasGlobalRole(userId, 'admin')
    return hasAdminTeamMembership
  } catch (e) {
    throw new Error(e.message)
  }
}

const hasMembershipInGlobalTeams = async (userId, teams) => {
  /* eslint-disable global-require */
  const config = require('config')
  const globalTeams = config.get('teams.global')
  const User = require('../../../models/user/user.model')
  /* eslint-enable global-require */

  const isGlobalList = await Promise.all(
    teams.map(async team =>
      User.hasGlobalRole(userId, globalTeams[team.role].role),
    ),
  )

  return isGlobalList.some(global => global)
}

const hasMembershipInTeam = async (userId, teamId) => {
  /* eslint-disable global-require */
  const TeamMember = require('../../../models/teamMember/teamMember.model')
  /* eslint-enable global-require */

  return TeamMember.findOne({ teamId, userId })
}

const isGlobal = async (userId, includeAdmin = false) => {
  try {
    /* eslint-disable global-require */
    const config = require('config')
    const globalTeams = config.get('teams.global')
    const User = require('../../../models/user/user.model')
    /* eslint-enable global-require */

    let globalTeamsKeys = Object.keys(globalTeams)

    if (!includeAdmin) {
      globalTeamsKeys = Object.keys(globalTeams).filter(
        team => team !== 'admin',
      )
    }

    const isGlobalList = await Promise.all(
      globalTeamsKeys.map(async team =>
        User.hasGlobalRole(userId, globalTeams[team].role),
      ),
    )

    return isGlobalList.some(global => global)
  } catch (e) {
    throw new Error(e.message)
  }
}

const isGlobalSpecific = async (userId, role) => {
  try {
    /* eslint-disable global-require */
    const User = require('../../../models/user/user.model')
    /* eslint-enable global-require */

    return User.hasGlobalRole(userId, role)
  } catch (e) {
    throw new Error(e.message)
  }
}

const hasEditAccessBasedOnRoleAndStage = async (
  role,
  bookComponentId,
  editAccessMatrix,
) => {
  try {
    /* eslint-disable global-require */
    const BookComponentState = require('../../../models/bookComponentState/bookComponentState.model')
    /* eslint-enable global-require */

    const bookComponentState = await BookComponentState.findOne({
      bookComponentId,
    })

    if (!bookComponentState) {
      throw new Error(
        `can not find associated book component state for book component with id ${bookComponentId}`,
      )
    }

    const { workflowStages } = bookComponentState

    const result = []
    editAccessMatrix[role].forEach(editItem => {
      if (find(workflowStages, editItem)) {
        result.push(true)
      }
    })
    return result.some(item => item)
  } catch (e) {
    throw new Error(e.message)
  }
}

const getUserStatus = async (teamId, userId) => {
  try {
    // eslint-disable-next-line global-require
    const TeamMember = require('../../../models/teamMember/teamMember.model')

    const teamMember = await TeamMember.findOne({ teamId, userId })

    return teamMember?.status
  } catch (e) {
    throw new Error(e.message)
  }
}

const getBookSpecificTeam = async (bookId, role) => {
  try {
    // eslint-disable-next-line global-require
    const Team = require('../../../models/team/team.model')

    return Team.findOne({ objectId: bookId, role })
  } catch (e) {
    throw new Error(e.message)
  }
}

module.exports = {
  isAuthenticated,
  isAdmin,
  isGlobal,
  isGlobalSpecific,
  hasEditAccessBasedOnRoleAndStage,
  hasMembershipInGlobalTeams,
  hasMembershipInTeam,
  getUserStatus,
  getBookSpecificTeam,
}
