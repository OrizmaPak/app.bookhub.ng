const { logger, useTransaction, TeamMember } = require('@coko/server')
const omitBy = require('lodash/omitBy')
const isUndefined = require('lodash/isUndefined')
const { Identity } = require('@coko/server')

const {
  notify,
  notificationTypes: { EMAIL },
} = require('@coko/server/src//services')

const Book = require('../models/book/book.model')
const { bookInvite } = require('./helpers/emailTemplates')

const { Team } = require('../models').models
const User = require('../models/user/user.model')

const getObjectTeam = async (
  role,
  objectId,
  withUsers = false,
  options = {},
) => {
  try {
    const { trx } = options

    if (!withUsers) {
      return Team.findTeamByRoleAndObject(role, objectId, options)
    }

    return Team.findOne(
      { role, objectId, global: false },
      { trx, related: 'users' },
    )
  } catch (e) {
    throw new Error(e)
  }
}

const createTeam = async (
  displayName,
  objectId = undefined,
  objectType = undefined,
  role = undefined,
  global = false,
  options = {},
) => {
  try {
    const { trx } = options

    return useTransaction(
      async tr => {
        const teamData = {
          displayName,
          objectId,
          objectType,
          role,
          global,
        }

        const cleanedData = omitBy(teamData, isUndefined)
        const newTeam = await Team.insert(cleanedData, { trx: tr })

        logger.info(`>>> team of type ${role} created with id ${newTeam.id}`)

        return newTeam
      },
      { trx },
    )
  } catch (e) {
    throw new Error(e)
  }
}

const updateTeamMemberStatus = async (teamMemberId, status, options = {}) => {
  try {
    const { trx } = options

    return useTransaction(
      async tr => {
        logger.info(
          `>>> team member with id ${teamMemberId} status updated to ${status}`,
        )

        const updatedTeamMember = await TeamMember.patchAndFetchById(
          teamMemberId,
          { status },
          { trx: tr },
        )

        return Team.findById(updatedTeamMember.teamId, { trx: tr })
      },
      { trx },
    )
  } catch (e) {
    throw new Error(e)
  }
}

const updateTeamMemberStatuses = async (teamId, status, options = {}) => {
  try {
    const { trx } = options

    return useTransaction(
      async tr => {
        logger.info(
          `>>> setting status of ${status} to all team member of team with id ${teamId}`,
        )

        const { result: teamMembers } = await TeamMember.find(
          { teamId },
          { trx: tr },
        )

        await Promise.all(
          teamMembers.map(async teamMember =>
            TeamMember.patchAndFetchById(
              teamMember.id,
              { status },
              { trx: tr },
            ),
          ),
        )

        return Team.findById(teamId, { trx: tr })
      },
      { trx },
    )
  } catch (e) {
    throw new Error(e)
  }
}

const deleteTeam = async (teamId, options = {}) => {
  try {
    const { trx } = options

    return useTransaction(
      async tr => {
        // const deletedTeam = await Team.patchAndFetchById(teamId, {
        //   objectId: null,
        //   objectType: null,
        // })
        const deletedTeam = await Team.deleteById(teamId, { trx: tr })
        logger.info(`>>> associated team with id ${teamId} deleted`)
        logger.info(`>>> corresponding team's object cleaned`)

        // const teamMembers = await TeamMember.query(tr).where({
        //   teamId,
        //   deleted: false,
        // })

        // logger.info(`>>> fetching team members of team with id ${teamId}`)
        // await Promise.all(
        //   map(teamMembers, async teamMember => {
        //     logger.info(`>>> team member with id ${teamMember.id} deleted`)
        //     return TeamMember.query(tr).deleteById(teamMember.id)
        //     // .patch({ deleted: true })
        //     // .where({ id: teamMember.id })
        //   }),
        // )
        return deletedTeam
      },
      { trx },
    )
  } catch (e) {
    throw new Error(e)
  }
}

const addTeamMembers = async (
  teamId,
  members,
  status,
  bookId,
  currentUserId,
  options = {},
) => {
  try {
    const { trx } = options

    return useTransaction(async tr => {
      await Promise.all(
        members.map(userId => Team.addMember(teamId, userId, { status })),
      )
    }).then(async () => {
      if (bookId) {
        const book = await Book.getUserBookDetails(currentUserId, bookId, {
          trx,
        })

        // Send email invitations
        Promise.all(
          members.map(async userId => {
            const identity = await Identity.findOne({
              userId,
            })

            const email = bookInvite({
              email: identity?.email,
              bookTitle: book.title,
              sharerEmail: book.email,
              sharerName: book.name,
              bookId: book.id,
              status,
            })

            notify(EMAIL, email)
          }),
        )
      }

      return Team.findById(teamId, { trx })
    })
  } catch (e) {
    throw new Error(e)
  }
}

const removeMemberIfExists = async (teamId, userId, options = {}) => {
  const { trx } = options
  const existing = await TeamMember.findOne({ teamId, userId }, { trx })

  if (!existing) return null

  return Team.removeMember(teamId, userId, { trx })
}

const transferBookOwnership = async (
  bookId,
  currentOwnerUserId,
  newOwnerUserId,
  options = {},
) => {
  try {
    const { trx } = options

    return useTransaction(
      async tr => {
        if (!bookId) throw new Error('Book id is required')
        if (!currentOwnerUserId) throw new Error('Current owner is required')
        if (!newOwnerUserId) throw new Error('New owner is required')

        if (currentOwnerUserId === newOwnerUserId) {
          throw new Error('You already own this book')
        }

        const newOwner = await User.findById(newOwnerUserId, { trx: tr })

        if (!newOwner || newOwner.isActive === false) {
          throw new Error('The selected user does not exist or is not active')
        }

        const ownerTeam = await getObjectTeam('owner', bookId, false, {
          trx: tr,
        })

        if (!ownerTeam) {
          throw new Error('Owner team was not found for this book')
        }

        const currentOwnerMembership = await TeamMember.findOne(
          {
            teamId: ownerTeam.id,
            userId: currentOwnerUserId,
          },
          { trx: tr },
        )

        if (!currentOwnerMembership) {
          throw new Error('Only the current owner can transfer ownership')
        }

        const collaboratorTeam = await getObjectTeam(
          'collaborator',
          bookId,
          false,
          { trx: tr },
        )

        await Team.updateMembershipByTeamId(
          ownerTeam.id,
          [newOwnerUserId],
          { trx: tr },
        )

        if (collaboratorTeam) {
          await removeMemberIfExists(collaboratorTeam.id, currentOwnerUserId, {
            trx: tr,
          })
          await removeMemberIfExists(collaboratorTeam.id, newOwnerUserId, {
            trx: tr,
          })
        }

        logger.info(
          `>>> ownership of book ${bookId} transferred from ${currentOwnerUserId} to ${newOwnerUserId}`,
        )

        return Team.findById(ownerTeam.id, { trx: tr })
      },
      { trx },
    )
  } catch (e) {
    logger.error(`>>> transferBookOwnership failed: ${e.message}`)
    throw new Error(e.message)
  }
}

module.exports = {
  createTeam,
  getObjectTeam,
  deleteTeam,
  updateTeamMemberStatus,
  updateTeamMemberStatuses,
  addTeamMembers,
  transferBookOwnership,
}
