const { logger } = require('@coko/server')

const {
  getBook,
  getBookTitle,
  getBookSubtitle,
  updatePODMetadata,
} = require('../../../controllers/book.controller')
const { getObjectTeam } = require('../../../controllers/team.controller')
const { isAdmin } = require('../../../controllers/user.controller')
const {
  applyThothContributorSyncMetadata,
  buildTemporaryDoi,
  getConnectionStatus,
  syncWork,
} = require('../../../services/thoth.service')

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

const resolveBookDoi = book => {
  if (book?.doi) {
    return book.doi
  }

  return buildTemporaryDoi(book?.id)
}

const thothConnectionStatusHandler = async (_, __, ctx) => {
  if (!ctx.userId) {
    throw new Error('Not authenticated')
  }

  return getConnectionStatus()
}

const ensureLiveSyncReadiness = ({ book, doi }) => {
  if (!doi) {
    throw new Error('A temporary DOI could not be generated for this book.')
  }

  if (!book?.publicationDate) {
    throw new Error(
      'Publication date is required before live Thoth sync. Set it in Metadata and validate again.',
    )
  }
}

const thothSyncWorkHandler = async (_, { bookId, dryRun }, ctx) => {
  if (!ctx.userId) {
    throw new Error('Not authenticated')
  }

  await ensureSyncAccess(bookId, ctx.userId)

  const { book, title, subtitle } = await getBookSnapshot(bookId)
  const resolvedDoi = resolveBookDoi(book)

  if (!dryRun) {
    ensureLiveSyncReadiness({
      book,
      doi: resolvedDoi,
    })
  }

  logger.info(
    `thoth resolver: syncing book ${bookId} to Thoth (dryRun=${Boolean(dryRun)})`,
  )

  const result = await syncWork({
    book,
    title,
    subtitle,
    doi: resolvedDoi,
    dryRun,
  })

  if (!dryRun) {
    const syncedPodMetadata = applyThothContributorSyncMetadata(book, result)

    if (syncedPodMetadata) {
      await updatePODMetadata(book.id, syncedPodMetadata)
    }
  }

  return result
}

module.exports = {
  Query: {
    thothConnectionStatus: thothConnectionStatusHandler,
  },
  Mutation: {
    thothSyncWork: thothSyncWorkHandler,
  },
}
