const { logger } = require('@coko/server')

const THOTH_GRAPHQL_ENDPOINT =
  process.env.THOTH_GRAPHQL_ENDPOINT || 'https://api.thoth.pub/graphql'

const DEFAULT_THOTH_IMPRINT_ID =
  process.env.THOTH_IMPRINT_ID || '3c598b87-ef90-43f1-82c1-9ebee640f8aa'

const DEFAULT_WORK_TYPE = process.env.THOTH_WORK_TYPE || 'MONOGRAPH'
const DEFAULT_WORK_STATUS = process.env.THOTH_WORK_STATUS || 'ACTIVE'
const DEFAULT_THOTH_EDITION = Number(process.env.THOTH_DEFAULT_EDITION) || 1
const DEFAULT_TEMP_DOI_PREFIX =
  process.env.THOTH_TEMP_DOI_PREFIX || 'https://doi.org/10.5555'

const CC_LICENSE_URLS = {
  BY: 'https://creativecommons.org/licenses/by/4.0/',
  'BY-NC': 'https://creativecommons.org/licenses/by-nc/4.0/',
  'BY-NC-ND': 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  'BY-NC-SA': 'https://creativecommons.org/licenses/by-nc-sa/4.0/',
  'BY-ND': 'https://creativecommons.org/licenses/by-nd/4.0/',
  'BY-SA': 'https://creativecommons.org/licenses/by-sa/4.0/',
}

const LICENSE_LABEL_URLS = {
  'CC BY 4.0': CC_LICENSE_URLS.BY,
  'CC BY-NC 4.0': CC_LICENSE_URLS['BY-NC'],
  'CC BY-NC-ND 4.0': CC_LICENSE_URLS['BY-NC-ND'],
  'CC BY-NC-SA 4.0': CC_LICENSE_URLS['BY-NC-SA'],
  'CC BY-ND 4.0': CC_LICENSE_URLS['BY-ND'],
  'CC BY-SA 4.0': CC_LICENSE_URLS['BY-SA'],
  'CC0 1.0 Universal': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'Public Domain Mark 1.0':
    'https://creativecommons.org/publicdomain/mark/1.0/',
}

const THOTH_DERIVABLE_NUMERIC_FIELDS = new Set([
  'pageCount',
  'imageCount',
  'tableCount',
  'audioCount',
  'videoCount',
])

const THOTH_DERIVABLE_STRING_FIELDS = new Set(['pageBreakdown'])

const CONTRIBUTION_TYPE_MAP = {
  author: 'AUTHOR',
  'co-author': 'AUTHOR',
  editor: 'EDITOR',
  'managing editor': 'EDITOR',
  proofreader: 'EDITOR',
  designer: 'CONTRIBUTIONS_BY',
  illustrator: 'ILLUSTRATOR',
  translator: 'TRANSLATOR',
  reviewer: 'CONTRIBUTIONS_BY',
}

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

const normalizeDoi = value => {
  const doi = String(value || '').trim()

  if (!doi) {
    return null
  }

  if (/^https:\/\/doi\.org\/10\.\d{4,9}\//i.test(doi)) {
    return doi
  }

  if (/^10\.\d{4,9}\//.test(doi)) {
    return `https://doi.org/${doi}`
  }

  return doi
}

const buildTemporaryDoi = bookId => {
  const suffix = sanitizeDoiSuffix(bookId)

  if (!suffix) {
    return null
  }

  return normalizeDoi(
    `${DEFAULT_TEMP_DOI_PREFIX.replace(/\/$/, '')}/bookhub-temp.${suffix}`,
  )
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

const isUrl = value => /^https?:\/\/\S+$/i.test(String(value || '').trim())

const getCreativeCommonsLicenseUrl = licenseTypes => {
  const flags = [
    licenseTypes?.NC ? 'NC' : null,
    licenseTypes?.ND ? 'ND' : null,
    licenseTypes?.SA ? 'SA' : null,
  ].filter(Boolean)

  const key = flags.length ? `BY-${flags.join('-')}` : 'BY'

  return CC_LICENSE_URLS[key] || null
}

const normalizeLicenseForThoth = book => {
  const podMetadata = book?.podMetadata || {}

  if (podMetadata.copyrightLicense === 'SCL') {
    return null
  }

  if (podMetadata.copyrightLicense === 'PD') {
    return podMetadata.publicDomainType === 'cc0'
      ? 'https://creativecommons.org/publicdomain/zero/1.0/'
      : 'https://creativecommons.org/publicdomain/mark/1.0/'
  }

  if (podMetadata.copyrightLicense === 'CC') {
    return getCreativeCommonsLicenseUrl(podMetadata.licenseTypes)
  }

  if (isUrl(book?.license)) {
    return book.license.trim()
  }

  if (book?.license) {
    return LICENSE_LABEL_URLS[book.license.trim()] || null
  }

  return null
}

const getUnmappedLicenseLabel = book => {
  const podMetadata = book?.podMetadata || {}
  const normalizedLicense = normalizeLicenseForThoth(book)

  if (normalizedLicense || podMetadata.copyrightLicense === 'SCL') {
    return null
  }

  if (
    podMetadata.copyrightLicense &&
    podMetadata.copyrightLicense !== 'SCL' &&
    !normalizedLicense
  ) {
    return podMetadata.copyrightLicense
  }

  if (book?.license && !isUrl(book.license)) {
    return book.license
  }

  return null
}

const normalizeDerivableInteger = value => {
  if (value === null || value === undefined || value === '') {
    return null
  }

  if (typeof value === 'boolean') {
    return null
  }

  const normalizedValue = Number(value)

  if (!Number.isInteger(normalizedValue) || normalizedValue < 0) {
    return null
  }

  return normalizedValue
}

const buildAdditionalMetadataPayload = book => {
  const derivableMetadata = book?.podMetadata?.derivableMetadata || []

  return derivableMetadata.reduce((payload, item) => {
    if (!item?.key) {
      return payload
    }

    if (THOTH_DERIVABLE_NUMERIC_FIELDS.has(item.key)) {
      const normalizedValue = normalizeDerivableInteger(item.value)

      if (normalizedValue !== null) {
        payload[item.key] = normalizedValue
      }
    }

    if (THOTH_DERIVABLE_STRING_FIELDS.has(item.key)) {
      const normalizedValue = String(item.value || '').trim()

      if (normalizedValue) {
        payload[item.key] = normalizedValue
      }
    }

    return payload
  }, {})
}

const normalizeOrcidForThoth = value => {
  const rawValue = String(value || '').trim()

  if (!rawValue) {
    return null
  }

  if (/^https:\/\/orcid\.org\//i.test(rawValue)) {
    return rawValue
  }

  if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(rawValue)) {
    return `https://orcid.org/${rawValue}`
  }

  return null
}

const splitContributorName = contributor => {
  const fullName = String(contributor?.fullName || '').trim()
  const parts = fullName.split(/\s+/).filter(Boolean)

  return {
    firstName: contributor?.firstName || parts.slice(0, -1).join(' ') || null,
    lastName: contributor?.lastName || parts.slice(-1)[0] || fullName,
    fullName,
  }
}

const normalizeContributionType = contributor => {
  const explicitType = String(contributor?.contributionType || '').trim()

  if (explicitType) {
    return explicitType
  }

  const role = String(contributor?.role || '').trim().toLowerCase()

  return CONTRIBUTION_TYPE_MAP[role] || 'CONTRIBUTIONS_BY'
}

const getThothRelationshipMetadata = book => {
  const podMetadata = book?.podMetadata || {}
  const contributors = (podMetadata.contributors || [])
    .filter(item => item?.includeInThoth !== false)
    .map((item, index) => {
      const names = splitContributorName(item)

      return cleanObject({
        ...names,
        orcid: normalizeOrcidForThoth(item?.orcid),
        website: isUrl(item?.website) ? item.website.trim() : null,
        contributionType: normalizeContributionType(item),
        contributionOrdinal:
          Number.isInteger(Number(item?.contributionOrdinal)) &&
          Number(item.contributionOrdinal) > 0
            ? Number(item.contributionOrdinal)
            : index + 1,
        mainContribution: item?.mainContribution === true || index === 0,
      })
    })
    .filter(item => item.fullName && item.lastName)

  const languages = (podMetadata.languages || [])
    .map(item => ({
      languageCode: String(item?.code || '').trim().toUpperCase(),
      languageRelation: item?.relation || 'ORIGINAL',
    }))
    .filter(item => item.languageCode)

  return {
    contributors,
    languages,
  }
}

const buildWorkPayload = ({ book, title, subtitle }) => {
  const license = normalizeLicenseForThoth(book)
  const additionalMetadata = buildAdditionalMetadataPayload(book)

  const rawPayload = {
    workType: DEFAULT_WORK_TYPE,
    workStatus: DEFAULT_WORK_STATUS,
    imprintId: DEFAULT_THOTH_IMPRINT_ID,
    reference: `bookhub:${book.id}`,
    edition: Number(book.edition) || DEFAULT_THOTH_EDITION,
    publicationDate: normalizeDate(book.publicationDate),
    landingPage: getLandingPage(book),
    license,
    copyrightHolder: book.copyrightHolder,
    generalNote: subtitle,
    coverCaption: title,
    ...additionalMetadata,
  }

  return cleanObject(rawPayload)
}

const getExistingWorkRelationships = async workId => {
  const result = await executeThothGraphQL({
    query: `
      query ExistingWorkRelationships($workId: Uuid!) {
        work(workId: $workId) {
          contributions {
            fullName
            contributionType
            contributionOrdinal
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

  return {
    contributions: result.data?.work?.contributions || [],
    languages: result.data?.work?.languages || [],
  }
}

const findContributor = async contributor => {
  const result = await executeThothGraphQL({
    query: `
      query FindContributor($filter: String) {
        contributors(limit: 20, filter: $filter) {
          contributorId
          fullName
          orcid
        }
      }
    `,
    variables: { filter: contributor.orcid || contributor.fullName },
  })

  const contributors = result.data?.contributors || []

  return (
    contributors.find(item => item.orcid && item.orcid === contributor.orcid) ||
    contributors.find(item => item.fullName === contributor.fullName) ||
    null
  )
}

const createContributor = async contributor => {
  const result = await executeThothGraphQL({
    query: `
      mutation CreateContributor($data: NewContributor!) {
        createContributor(data: $data) {
          contributorId
        }
      }
    `,
    variables: {
      data: cleanObject({
        firstName: contributor.firstName,
        lastName: contributor.lastName,
        fullName: contributor.fullName,
        orcid: contributor.orcid,
        website: contributor.website,
      }),
    },
  })

  return result.data?.createContributor?.contributorId
}

const findOrCreateContributor = async contributor => {
  const existingContributor = await findContributor(contributor)

  if (existingContributor?.contributorId) {
    return existingContributor.contributorId
  }

  return createContributor(contributor)
}

const nextAvailableContributionOrdinal = (preferredOrdinal, usedOrdinals) => {
  const preferred = Number(preferredOrdinal)

  if (
    Number.isInteger(preferred) &&
    preferred > 0 &&
    !usedOrdinals.has(preferred)
  ) {
    return preferred
  }

  let nextOrdinal = 1

  while (usedOrdinals.has(nextOrdinal)) {
    nextOrdinal += 1
  }

  return nextOrdinal
}

const syncWorkRelationships = async ({ workId, book }) => {
  const { contributors, languages } = getThothRelationshipMetadata(book)

  if (!contributors.length && !languages.length) {
    return {
      contributors: 0,
      languages: 0,
    }
  }

  const existing = await getExistingWorkRelationships(workId)
  const usedContributionOrdinals = new Set(
    existing.contributions
      .map(item => Number(item.contributionOrdinal))
      .filter(ordinal => Number.isInteger(ordinal) && ordinal > 0),
  )

  let syncedLanguages = 0
  let syncedContributors = 0

  for (const language of languages) {
    const exists = existing.languages.some(
      item =>
        item.languageCode === language.languageCode &&
        item.languageRelation === language.languageRelation,
    )

    if (exists) {
      continue
    }

    await executeThothGraphQL({
      query: `
        mutation CreateLanguage($data: NewLanguage!) {
          createLanguage(data: $data) {
            languageId
          }
        }
      `,
      variables: {
        data: {
          workId,
          ...language,
        },
      },
    })

    syncedLanguages += 1
  }

  for (const contributor of contributors) {
    const exists = existing.contributions.some(
      item =>
        item.fullName === contributor.fullName &&
        item.contributionType === contributor.contributionType,
    )

    if (exists) {
      continue
    }

    const contributorId = await findOrCreateContributor(contributor)
    const contributionOrdinal = nextAvailableContributionOrdinal(
      contributor.contributionOrdinal,
      usedContributionOrdinals,
    )

    await executeThothGraphQL({
      query: `
        mutation CreateContribution($data: NewContribution!) {
          createContribution(data: $data) {
            contributionId
          }
        }
      `,
      variables: {
        data: {
          workId,
          contributorId,
          contributionType: contributor.contributionType,
          mainContribution: Boolean(contributor.mainContribution),
          firstName: contributor.firstName,
          lastName: contributor.lastName,
          fullName: contributor.fullName,
          contributionOrdinal,
        },
      },
    })

    usedContributionOrdinals.add(contributionOrdinal)
    existing.contributions.push({
      fullName: contributor.fullName,
      contributionType: contributor.contributionType,
      contributionOrdinal,
    })

    syncedContributors += 1
  }

  return {
    contributors: syncedContributors,
    languages: syncedLanguages,
  }
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
  const normalizedDoi = normalizeDoi(doi)
  const unmappedLicense = getUnmappedLicenseLabel(book)

  if (normalizedDoi) {
    payload.doi = normalizedDoi
  }

  if (!dryRun && unmappedLicense) {
    throw new Error(
      `Unsupported license for Thoth sync: ${unmappedLicense}. Select a supported Creative Commons/Public Domain license or use a license URL.`,
    )
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

  const existingWorkId = await findWorkByDoi(normalizedDoi)

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
    const relationshipSync = await syncWorkRelationships({
      workId: result.data?.updateWork?.workId || existingWorkId,
      book,
    })

    return {
      ok: true,
      workId: result.data?.updateWork?.workId || existingWorkId,
      operation: 'update',
      connection,
      payload,
      message: `Existing Thoth work updated successfully. Added ${relationshipSync.contributors} contributor(s) and ${relationshipSync.languages} language record(s).`,
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
  const createdWorkId = created.data?.createWork?.workId || null
  const relationshipSync = createdWorkId
    ? await syncWorkRelationships({
        workId: createdWorkId,
        book,
      })
    : { contributors: 0, languages: 0 }

  return {
    ok: true,
    workId: createdWorkId,
    operation: 'create',
    connection,
    payload,
    message: `New Thoth work created successfully. Added ${relationshipSync.contributors} contributor(s) and ${relationshipSync.languages} language record(s).`,
  }
}

module.exports = {
  buildAdditionalMetadataPayload,
  buildTemporaryDoi,
  buildWorkPayload,
  getConnectionStatus,
  normalizeDoi,
  normalizeLicenseForThoth,
  syncWork,
}
