const { logger } = require('@coko/server')

const { getBook, getBookTitle, getBookSubtitle } = require('../../../controllers/book.controller')
const { getObjectTeam } = require('../../../controllers/team.controller')
const { isAdmin } = require('../../../controllers/user.controller')
const { getConnectionStatus, syncWork } = require('../../../services/thoth.service')

const canSyncBookToThoth = async (bookId, userId) => {
  if (!userId) {
    return false
  }

  if (await isAdmin(userId)) {
    return true
  }

  const [ownerTeam, authorTeam] = await Promise.all([
    getObjectTeam('owner', bookId, true),
    getObjectTeam('author', bookId, true),
  ])

  const isInTeam = team => {
    return !!team?.users?.some(member => member.id === userId)
  }

  return isInTeam(ownerTeam) || isInTeam(authorTeam)
}

const ensureSyncAccess = async (bookId, userId) => {
  const canSync = await canSyncBookToThoth(bookId, userId)

  if (!canSync) {
    throw new Error('Not authorized to sync this book to Thoth.')
  }
}

const getBookSnapshot = async bookId => {
  const book = await getBook(bookId)

  const [title, subtitle] = await Promise.all([
    book.title ? Promise.resolve(book.title) : getBookTitle(book.id),
    book.subtitle ? Promise.resolve(book.subtitle) : getBookSubtitle(book.id),
  ])

  return {
    book,
    title,
    subtitle,
  }
}

const thothConnectionStatusHandler = async (_, __, ctx) => {
  if (!ctx.userId) {
    throw new Error('Not authenticated')
  }

  return getConnectionStatus()
}

const thothSyncWorkHandler = async (_, { bookId, dryRun }, ctx) => {
  if (!ctx.userId) {
    throw new Error('Not authenticated')
  }

  await ensureSyncAccess(bookId, ctx.userId)

  const { book, title, subtitle } = await getBookSnapshot(bookId)

  // Manual DOI phase: allow DOI from env fallback while product DOI fields are introduced.
  const configuredDoi = process.env.THOTH_DEFAULT_DOI || null

  const resolvedDoi = configuredDoi || null

  if (!dryRun && !resolvedDoi) {
    throw new Error(
      'DOI is required before live Thoth sync. Set THOTH_DEFAULT_DOI for controlled testing.',
    )
  }

  logger.info(
    `thoth resolver: syncing book ${bookId} to Thoth (dryRun=${Boolean(dryRun)})`,
  )

  return syncWork({
    book,
    title,
    subtitle,
    doi: resolvedDoi,
    dryRun,
  })
}

module.exports = {
  Query: {
    thothConnectionStatus: thothConnectionStatusHandler,
  },
  Mutation: {
    thothSyncWork: thothSyncWorkHandler,
  },
}
