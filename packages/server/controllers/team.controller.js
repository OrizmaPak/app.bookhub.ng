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

const {
  BookComponent,
  BookOwnershipTransfer,
  Lock,
  Team,
} = require('../models').models

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

const clearUserBookLocks = async (bookId, userId, trx) => {
  const bookComponents = await BookComponent.query(trx)
    .select('id')
    .where({ bookId, deleted: false })

  const componentIds = bookComponents.map(component => component.id).filter(Boolean)

  if (!componentIds.length) return 0

  return Lock.query(trx)
    .delete()
    .whereIn('foreignId', componentIds)
    .where({
      foreignType: 'bookComponent',
      userId,
    })
}

const ensureCurrentOwner = async (bookId, userId, trx) => {
  const ownerTeam = await getObjectTeam('owner', bookId, false, { trx })

  if (!ownerTeam) {
    throw new Error('Owner team was not found for this book')
  }

  const ownerMembership = await TeamMember.findOne(
    {
      teamId: ownerTeam.id,
      userId,
    },
    { trx },
  )

  if (!ownerMembership) {
    throw new Error('The expected current owner no longer owns this book')
  }

  return ownerTeam
}

const removeUserFromBookTeams = async (
  bookId,
  userId,
  trx,
  excludeTeamIds = [],
) => {
  const excluded = new Set(excludeTeamIds)

  const teams = await Team.query(trx)
    .select('id')
    .where({
      objectId: bookId,
      global: false,
    })

  const targetTeams = teams.filter(team => !excluded.has(team.id))

  await Promise.all(
    targetTeams.map(team =>
      removeMemberIfExists(team.id, userId, {
        trx,
      }),
    ),
  )
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

        const ownerTeam = await ensureCurrentOwner(bookId, currentOwnerUserId, tr)

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

        await removeUserFromBookTeams(
          bookId,
          currentOwnerUserId,
          tr,
          [ownerTeam.id],
        )

        await removeUserFromBookTeams(bookId, newOwnerUserId, tr, [
          ownerTeam.id,
        ])

        const releasedLocks = await clearUserBookLocks(bookId, currentOwnerUserId, tr)

        await BookOwnershipTransfer.query(tr)
          .where({
            bookId,
            deleted: false,
            status: 'active',
          })
          .patch({
            status: 'superseded',
            updated: new Date().toISOString(),
          })

        await BookOwnershipTransfer.insert(
          {
            bookId,
            fromUserId: currentOwnerUserId,
            toUserId: newOwnerUserId,
            transferredByUserId: currentOwnerUserId,
            status: 'active',
            metadata: {
              releasedLocks,
            },
          },
          { trx: tr },
        )

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

const revokeBookOwnershipTransfer = async (
  transferId,
  revokedByUserId,
  reason = null,
  options = {},
) => {
  try {
    const { trx, revokedByEmail = null } = options

    return useTransaction(
      async tr => {
        if (!transferId) throw new Error('Transfer id is required')

        if (!revokedByUserId && !revokedByEmail) {
          throw new Error('Revoking user or email is required')
        }

        const transfer = await BookOwnershipTransfer.findById(transferId, {
          trx: tr,
        })

        if (!transfer || transfer.deleted) {
          throw new Error('Ownership transfer record was not found')
        }

        if (transfer.status !== 'active') {
          throw new Error('Only active ownership transfers can be revoked')
        }

        const ownerTeam = await ensureCurrentOwner(
          transfer.bookId,
          transfer.toUserId,
          tr,
        )

        const collaboratorTeam = await getObjectTeam(
          'collaborator',
          transfer.bookId,
          false,
          { trx: tr },
        )

        await Team.updateMembershipByTeamId(
          ownerTeam.id,
          [transfer.fromUserId],
          { trx: tr },
        )

        if (collaboratorTeam) {
          await removeMemberIfExists(collaboratorTeam.id, transfer.fromUserId, {
            trx: tr,
          })
          await removeMemberIfExists(collaboratorTeam.id, transfer.toUserId, {
            trx: tr,
          })
        }

        await removeUserFromBookTeams(
          transfer.bookId,
          transfer.fromUserId,
          tr,
          [ownerTeam.id],
        )

        await removeUserFromBookTeams(
          transfer.bookId,
          transfer.toUserId,
          tr,
          [ownerTeam.id],
        )

        const releasedLocks = await clearUserBookLocks(
          transfer.bookId,
          transfer.toUserId,
          tr,
        )

        const metadata = {
          ...(transfer.metadata || {}),
          revokedByEmail,
          revokeReleasedLocks: releasedLocks,
        }

        const revoked = await BookOwnershipTransfer.patchAndFetchById(
          transfer.id,
          {
            status: 'revoked',
            revokedByUserId,
            revokedAt: new Date().toISOString(),
            revokeReason: reason || null,
            metadata,
          },
          { trx: tr },
        )

        logger.info(
          `>>> ownership transfer ${transferId} revoked by ${revokedByUserId}`,
        )

        return revoked
      },
      { trx },
    )
  } catch (e) {
    logger.error(`>>> revokeBookOwnershipTransfer failed: ${e.message}`)
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
  revokeBookOwnershipTransfer,
}
