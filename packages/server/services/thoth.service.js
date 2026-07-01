const { logger } = require('@coko/server')

const THOTH_GRAPHQL_ENDPOINT =
  process.env.THOTH_GRAPHQL_ENDPOINT || 'https://api.thoth.pub/graphql'

const DEFAULT_THOTH_IMPRINT_ID =
  process.env.THOTH_IMPRINT_ID || '3c598b87-ef90-43f1-82c1-9ebee640f8aa'

const DEFAULT_WORK_TYPE = process.env.THOTH_WORK_TYPE || 'MONOGRAPH'
const DEFAULT_WORK_STATUS = process.env.THOTH_WORK_STATUS || 'ACTIVE'
const DEFAULT_TEMP_DOI_PREFIX = process.env.THOTH_TEMP_DOI_PREFIX || '10.5555'

const cleanObject = input => {
  return Object.fromEntries(
    Object.entries(input).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    ),
  )
}

const normalizeDate = rawValue => {
  if (!rawValue) return null

  const parsed = new Date(rawValue)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

const sanitizeDoiSuffix = value => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9./_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const buildTemporaryDoi = bookId => {
  const suffix = sanitizeDoiSuffix(bookId)

  if (!suffix) {
    return null
  }

  return `${DEFAULT_TEMP_DOI_PREFIX}/bookhub-temp.${suffix}`
}

const resolveAuth = () => {
  const token = process.env.THOTH_API_TOKEN
  const username = process.env.THOTH_API_USERNAME
  const password = process.env.THOTH_API_PASSWORD

  if (token) {
    return {
      authMode: 'token',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    }
  }

  if (username && password) {
    const encodedCreds = Buffer.from(`${username}:${password}`).toString(
      'base64',
    )

    return {
      authMode: 'basic',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${encodedCreds}`,
      },
    }
  }

  return {
    authMode: 'none',
    headers: {
      'Content-Type': 'application/json',
    },
  }
}

const executeThothGraphQL = async ({ query, variables }) => {
  const { headers, authMode } = resolveAuth()
  const response = await fetch(THOTH_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })
  const payload = await response.json()

  if (payload.errors?.length) {
    const details = payload.errors.map(error => error.message).join('; ')
    throw new Error(details)
  }

  return {
    data: payload.data,
    authMode,
    endpoint: THOTH_GRAPHQL_ENDPOINT,
  }
}

const getLandingPage = book => {
  const explicitUrl = book?.webPublishInfo?.publicUrl

  if (explicitUrl) {
    return explicitUrl
  }

  const forcedBase = process.env.THOTH_HTML_BASE_URL

  if (forcedBase) {
    return `${forcedBase.replace(/\/$/, '')}/books/${book.id}`
  }

  return null
}

const buildWorkPayload = ({ book, title, subtitle }) => {
  const rawPayload = {
    workType: DEFAULT_WORK_TYPE,
    workStatus: DEFAULT_WORK_STATUS,
    imprintId: DEFAULT_THOTH_IMPRINT_ID,
    reference: `bookhub:${book.id}`,
    publicationDate: normalizeDate(book.publicationDate),
    landingPage: getLandingPage(book),
    license: book.license,
    copyrightHolder: book.copyrightHolder,
    generalNote: subtitle,
    coverCaption: title,
  }

  return cleanObject(rawPayload)
}

const getConnectionStatus = async () => {
  const { authMode } = resolveAuth()

  try {
    await executeThothGraphQL({
      query: 'query ThothAuthProbe { me { __typename } }',
    })

    return {
      ok: true,
      endpoint: THOTH_GRAPHQL_ENDPOINT,
      authMode,
      message: 'Thoth authentication is valid.',
    }
  } catch (error) {
    logger.warn(`Thoth auth probe failed: ${error.message}`)

    return {
      ok: false,
      endpoint: THOTH_GRAPHQL_ENDPOINT,
      authMode,
      message: error.message,
    }
  }
}

const findWorkByDoi = async doi => {
  if (!doi) {
    return null
  }

  try {
    const result = await executeThothGraphQL({
      query: `
        query WorkByDoi($doi: Doi!) {
          workByDoi(doi: $doi) {
            workId
          }
        }
      `,
      variables: { doi },
    })

    return result.data?.workByDoi?.workId || null
  } catch (error) {
    if (error.message.includes('No record was found')) {
      return null
    }

    throw error
  }
}

const syncWork = async ({ book, title, subtitle, doi, dryRun }) => {
  const payload = buildWorkPayload({ book, title, subtitle })

  if (doi) {
    payload.doi = doi
  }

  const connection = await getConnectionStatus()

  if (dryRun) {
    return {
      ok: connection.ok,
      workId: null,
      operation: 'dry-run',
      connection,
      payload,
      message: connection.ok
        ? 'Dry run completed. Payload is ready for Thoth.'
        : 'Dry run completed, but Thoth authentication is not ready.',
    }
  }

  if (!connection.ok) {
    throw new Error(`Thoth connection failed: ${connection.message}`)
  }

  const existingWorkId = await findWorkByDoi(doi)

  if (existingWorkId) {
    const result = await executeThothGraphQL({
      query: `
        mutation UpdateWork($data: PatchWork!) {
          updateWork(data: $data) {
            workId
          }
        }
      `,
      variables: {
        data: {
          workId: existingWorkId,
          ...payload,
        },
      },
    })

    return {
      ok: true,
      workId: result.data?.updateWork?.workId || existingWorkId,
      operation: 'update',
      connection,
      payload,
      message: 'Existing Thoth work updated successfully.',
    }
  }

  const created = await executeThothGraphQL({
    query: `
      mutation CreateWork($data: NewWork!) {
        createWork(data: $data) {
          workId
        }
      }
    `,
    variables: {
      data: payload,
    },
  })

  return {
    ok: true,
    workId: created.data?.createWork?.workId || null,
    operation: 'create',
    connection,
    payload,
    message: 'New Thoth work created successfully.',
  }
}

module.exports = {
  buildTemporaryDoi,
  buildWorkPayload,
  getConnectionStatus,
  syncWork,
}
