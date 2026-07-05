const DEFAULT_BOOKHUB_PUBLISHER_ID =
  process.env.THOTH_PUBLISHER_ID || '930da856-0134-4e4c-93e9-2647da4d32ab'

const DEFAULT_BOOKHUB_IMPRINT_ID =
  process.env.THOTH_IMPRINT_ID || '3c598b87-ef90-43f1-82c1-9ebee640f8aa'

const DEFAULT_TEST_ENDPOINT =
  process.env.THOTH_TEST_GRAPHQL_ENDPOINT || 'https://api.test.thoth.pub/graphql'

const DEFAULT_LIVE_ENDPOINT =
  process.env.THOTH_LIVE_GRAPHQL_ENDPOINT || 'https://api.thoth.pub/graphql'

const LEGACY_ENDPOINT =
  process.env.THOTH_GRAPHQL_ENDPOINT || 'https://api.thoth.pub/graphql'

const THOTH_READ_TIMEOUT_MS =
  Number(process.env.THOTH_READ_TIMEOUT_MS) || 15000

const isBookHubSyncRecord = work => {
  const reference = `${work?.reference || ''}`.toLowerCase()
  const doi = `${work?.doi || ''}`.toLowerCase()
  const landingPage = `${work?.landingPage || ''}`.toLowerCase()

  return (
    reference.startsWith('bookhub') ||
    doi.includes('bookhub-temp.') ||
    landingPage.includes('app.bookhub.ng/books/')
  )
}

const getEnvironmentConfigs = () => {
  const environments = []

  if (process.env.THOTH_TEST_API_TOKEN) {
    environments.push({
      key: 'test',
      label: 'Test',
      endpoint: DEFAULT_TEST_ENDPOINT,
      token: process.env.THOTH_TEST_API_TOKEN,
      publisherId: DEFAULT_BOOKHUB_PUBLISHER_ID,
      imprintId: DEFAULT_BOOKHUB_IMPRINT_ID,
    })
  }

  if (process.env.THOTH_LIVE_API_TOKEN) {
    environments.push({
      key: 'live',
      label: 'Live',
      endpoint: DEFAULT_LIVE_ENDPOINT,
      token: process.env.THOTH_LIVE_API_TOKEN,
      publisherId: DEFAULT_BOOKHUB_PUBLISHER_ID,
      imprintId: DEFAULT_BOOKHUB_IMPRINT_ID,
    })
  }

  if (!environments.length && process.env.THOTH_API_TOKEN) {
    environments.push({
      key: LEGACY_ENDPOINT.includes('api.test.thoth.pub') ? 'test' : 'live',
      label: LEGACY_ENDPOINT.includes('api.test.thoth.pub') ? 'Test' : 'Live',
      endpoint: LEGACY_ENDPOINT,
      token: process.env.THOTH_API_TOKEN,
      publisherId: DEFAULT_BOOKHUB_PUBLISHER_ID,
      imprintId: DEFAULT_BOOKHUB_IMPRINT_ID,
    })
  }

  return environments
}

const getEnvironmentConfig = environment => {
  const environments = getEnvironmentConfigs()

  if (!environments.length) {
    throw new Error('No Thoth browser environments are configured.')
  }

  if (environment) {
    const match = environments.find(item => item.key === environment)

    if (!match) {
      throw new Error(`Unsupported Thoth environment: ${environment}`)
    }

    return match
  }

  const preferred = environments.find(item => item.key === 'test')
  return preferred || environments[0]
}

const executeThothReadQuery = async ({ environment, query, variables = {} }) => {
  const target = getEnvironmentConfig(environment)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), THOTH_READ_TIMEOUT_MS)

  try {
    const response = await fetch(target.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${target.token}`,
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    })

    const payload = await response.json()

    if (payload.errors?.length) {
      throw new Error(payload.errors.map(error => error.message).join('; '))
    }

    return {
      environment: target.key,
      label: target.label,
      endpoint: target.endpoint,
      publisherId: target.publisherId,
      imprintId: target.imprintId,
      data: payload.data,
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Thoth request timed out after ${THOTH_READ_TIMEOUT_MS}ms.`)
    }

    throw error
  } finally {
    clearTimeout(timeout)
  }
}

const resolveCanonicalTitle = work => {
  const titles = work?.titles || []
  const canonical = titles.find(item => item.canonical) || titles[0]

  return {
    title: canonical?.title || canonical?.fullTitle || work?.coverCaption || 'Untitled',
    subtitle: canonical?.subtitle || work?.generalNote || null,
  }
}

const normalizeWorkSummary = (work, publisherId, imprintId) => {
  const { title, subtitle } = resolveCanonicalTitle(work)
  const workPublisherId = work?.imprint?.publisher?.publisherId || null
  const workImprintId = work?.imprint?.imprintId || null

  return {
    workId: work.workId,
    title,
    subtitle,
    doi: work.doi || null,
    reference: work.reference || null,
    publicationDate: work.publicationDate || null,
    updatedAt: work.updatedAtWithRelations || work.updatedAt || null,
    landingPage: work.landingPage || null,
    publisherId: workPublisherId,
    publisherName: work?.imprint?.publisher?.publisherName || null,
    imprintId: workImprintId,
    imprintName: work?.imprint?.imprintName || null,
    isBookHubPublisher: workPublisherId === publisherId || workImprintId === imprintId,
    isBookHubSynced: isBookHubSyncRecord(work),
  }
}

const listWorksForSyncedFilter = async ({
  environment,
  search = '',
  publisherOnly = false,
  page = 1,
  pageSize = 50,
}) => {
  const target = getEnvironmentConfig(environment)
  const normalizedPage = Math.max(1, Number(page) || 1)
  const normalizedPageSize = Math.max(1, Math.min(Number(pageSize) || 20, 100))
  const scanLimit = Math.min(Math.max(normalizedPageSize * 5, 50), 100)
  const scanOffset = (normalizedPage - 1) * scanLimit

  const result = await executeThothReadQuery({
    environment,
    query: `
      query BackAdminThothWorks(
        $limit: Int
        $offset: Int
        $filter: String
        $publishers: [Uuid!]
      ) {
        works(
          limit: $limit
          offset: $offset
          filter: $filter
          publishers: $publishers
          order: { field: UPDATED_AT_WITH_RELATIONS, direction: DESC }
        ) {
          workId
          reference
          doi
          publicationDate
          updatedAt
          updatedAtWithRelations
          landingPage
          generalNote
          coverCaption
          titles {
            fullTitle
            title
            subtitle
            canonical
          }
          imprint {
            imprintId
            imprintName
            publisher {
              publisherId
              publisherName
            }
          }
        }
      }
    `,
    variables: {
      limit: scanLimit,
      offset: scanOffset,
      filter: search || 'bookhub',
      publishers: publisherOnly ? [target.publisherId] : undefined,
    },
  })

  return result.data?.works || []
}

const getThothStatus = async () => {
  const environments = getEnvironmentConfigs()

  if (!environments.length) {
    return {
      defaultEnvironment: null,
      environments: [],
    }
  }

  const statuses = await Promise.all(
    environments.map(async env => {
      try {
        const result = await executeThothReadQuery({
          environment: env.key,
          query: `
            query BackAdminThothStatus($publisherId: Uuid!, $imprintId: Uuid!) {
              me { __typename }
              publisher(publisherId: $publisherId) {
                publisherId
                publisherName
              }
              imprint(imprintId: $imprintId) {
                imprintId
                imprintName
              }
            }
          `,
          variables: {
            publisherId: env.publisherId,
            imprintId: env.imprintId,
          },
        })

        return {
          key: env.key,
          label: env.label,
          endpoint: env.endpoint,
          ok: true,
          message: 'Connected',
          publisherId: env.publisherId,
          publisherName: result.data?.publisher?.publisherName || null,
          imprintId: env.imprintId,
          imprintName: result.data?.imprint?.imprintName || null,
        }
      } catch (error) {
        return {
          key: env.key,
          label: env.label,
          endpoint: env.endpoint,
          ok: false,
          message: error.message,
          publisherId: env.publisherId,
          publisherName: null,
          imprintId: env.imprintId,
          imprintName: null,
        }
      }
    }),
  )

  return {
    defaultEnvironment: statuses.find(item => item.key === 'test')?.key || statuses[0].key,
    environments: statuses,
  }
}

const getThothWorks = async ({
  environment,
  search = '',
  publisherOnly = false,
  syncedOnly = false,
  page = 1,
  pageSize = 20,
}) => {
  const target = getEnvironmentConfig(environment)
  const normalizedPage = Math.max(1, Number(page) || 1)
  const normalizedPageSize = Math.max(1, Math.min(Number(pageSize) || 20, 100))

  if (syncedOnly) {
    const scannedItems = await listWorksForSyncedFilter({
      environment: target.key,
      search,
      publisherOnly,
      page: normalizedPage,
      pageSize: normalizedPageSize,
    })

    const normalized = scannedItems
      .map(item => normalizeWorkSummary(item, target.publisherId, target.imprintId))
      .filter(item => item.isBookHubSynced)

    const totalCount = normalized.length

    return {
      environment: target.key,
      page: normalizedPage,
      pageSize: normalizedPageSize,
      totalCount,
      items: normalized.slice(0, normalizedPageSize),
    }
  }

  const result = await executeThothReadQuery({
    environment: target.key,
    query: `
      query BackAdminThothWorks(
        $limit: Int
        $offset: Int
        $filter: String
        $publishers: [Uuid!]
      ) {
        workCount(filter: $filter, publishers: $publishers)
        works(
          limit: $limit
          offset: $offset
          filter: $filter
          publishers: $publishers
          order: { field: UPDATED_AT_WITH_RELATIONS, direction: DESC }
        ) {
          workId
          reference
          doi
          publicationDate
          updatedAt
          updatedAtWithRelations
          landingPage
          generalNote
          coverCaption
          titles {
            fullTitle
            title
            subtitle
            canonical
          }
          imprint {
            imprintId
            imprintName
            publisher {
              publisherId
              publisherName
            }
          }
        }
      }
    `,
    variables: {
      limit: normalizedPageSize,
      offset: (normalizedPage - 1) * normalizedPageSize,
      filter: search || '',
      publishers: publisherOnly ? [target.publisherId] : undefined,
    },
  })

  return {
    environment: target.key,
    page: normalizedPage,
    pageSize: normalizedPageSize,
    totalCount: result.data?.workCount || 0,
    items: (result.data?.works || []).map(item =>
      normalizeWorkSummary(item, target.publisherId, target.imprintId),
    ),
  }
}

const getThothWork = async ({ environment, workId }) => {
  const target = getEnvironmentConfig(environment)

  const result = await executeThothReadQuery({
    environment: target.key,
    query: `
      query BackAdminThothWork($workId: Uuid!) {
        work(workId: $workId) {
          workId
          reference
          doi
          workType
          workStatus
          edition
          publicationDate
          updatedAt
          updatedAtWithRelations
          landingPage
          license
          copyrightHolder
          generalNote
          coverCaption
          pageCount
          pageBreakdown
          imageCount
          tableCount
          audioCount
          videoCount
          firstPage
          lastPage
          pageInterval
          lccn
          oclc
          imprint {
            imprintId
            imprintName
            publisher {
              publisherId
              publisherName
            }
          }
          titles {
            titleId
            fullTitle
            title
            subtitle
            canonical
            localeCode
          }
          contributions {
            contributionId
            fullName
            contributionType
            contributionOrdinal
            mainContribution
            firstName
            lastName
          }
          publications {
            publicationId
            publicationType
            isbn
            updatedAt
            locations {
              locationId
              landingPage
              fullTextUrl
              locationPlatform
              canonical
            }
          }
          subjects {
            subjectType
            subjectCode
            subjectOrdinal
          }
          languages {
            languageCode
            languageRelation
          }
        }
      }
    `,
    variables: { workId },
  })

  const work = result.data?.work

  if (!work) {
    throw new Error('Thoth work not found.')
  }

  const normalized = normalizeWorkSummary(work, target.publisherId, target.imprintId)

  return {
    ...normalized,
    workType: work.workType,
    workStatus: work.workStatus,
    edition: work.edition,
    license: work.license,
    copyrightHolder: work.copyrightHolder,
    generalNote: work.generalNote,
    coverCaption: work.coverCaption,
    pageCount: work.pageCount,
    pageBreakdown: work.pageBreakdown,
    imageCount: work.imageCount,
    tableCount: work.tableCount,
    audioCount: work.audioCount,
    videoCount: work.videoCount,
    firstPage: work.firstPage,
    lastPage: work.lastPage,
    pageInterval: work.pageInterval,
    lccn: work.lccn,
    oclc: work.oclc,
    titles: (work.titles || []).map(item => ({
      titleId: item.titleId || null,
      fullTitle: item.fullTitle || item.title || 'Untitled',
      title: item.title || item.fullTitle || 'Untitled',
      subtitle: item.subtitle || null,
      canonical: Boolean(item.canonical),
      localeCode: item.localeCode || 'en-US',
    })),
    contributors: (work.contributions || []).map(item => ({
      contributionId: item.contributionId,
      fullName: item.fullName || [item.firstName, item.lastName].filter(Boolean).join(' ') || 'Unknown',
      contributionType: item.contributionType || 'UNKNOWN',
      contributionOrdinal: Number(item.contributionOrdinal) || 0,
      mainContribution: Boolean(item.mainContribution),
      firstName: item.firstName || null,
      lastName: item.lastName || '',
    })),
    publications: (work.publications || []).map(item => ({
      publicationId: item.publicationId,
      publicationType: item.publicationType || 'UNKNOWN',
      isbn: item.isbn || null,
      updatedAt: item.updatedAt,
      locations: (item.locations || []).map(location => ({
        locationId: location.locationId,
        landingPage: location.landingPage || null,
        fullTextUrl: location.fullTextUrl || null,
        locationPlatform: location.locationPlatform || 'UNKNOWN',
        canonical: Boolean(location.canonical),
      })),
    })),
    subjects: (work.subjects || []).map(item => ({
      subjectType: item.subjectType || 'UNKNOWN',
      subjectCode: item.subjectCode || '',
      subjectOrdinal: Number(item.subjectOrdinal) || 0,
    })),
    languages: (work.languages || []).map(item => ({
      languageCode: item.languageCode || 'unknown',
      languageRelation: item.languageRelation || 'UNKNOWN',
    })),
  }
}

module.exports = {
  getThothStatus,
  getThothWorks,
  getThothWork,
}
