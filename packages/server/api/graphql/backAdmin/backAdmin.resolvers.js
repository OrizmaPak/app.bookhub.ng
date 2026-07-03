const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const { logger } = require('@coko/server')
const { enqueueEmailJobs } = require('../../../services/emailQueue.service')

const {
  getThothStatus,
  getThothWorks,
  getThothWork,
} = require('../../../services/backAdminThoth.service')

const { models } = require('../../../models')

const CONTEXT = 'bookBuilder'
const SIGN_IN_AREA = 'signInEnabled'
const SIGN_UP_AREA = 'signUpEnabled'

const {
  ApplicationParameter,
  Book,
  User,
  UserSession,
  EmailJob,
  BackAdminOtp,
  InstanceMetric,
} = models

const SESSION_STORE_ERROR = 'Session store is not available. Run migrations.'
const OTP_TTL_MINUTES = Number.parseInt(process.env.BACK_ADMIN_OTP_TTL_MINUTES || '10', 10)

const OTP_MAX_ATTEMPTS = Number.parseInt(
  process.env.BACK_ADMIN_OTP_MAX_ATTEMPTS || '5',
  10,
)

const SESSION_TTL_SECONDS = Number.parseInt(
  process.env.BACK_ADMIN_SESSION_TTL_SECONDS || '28800',
  10,
)

const OTP_SECRET = process.env.BACK_ADMIN_OTP_SECRET || process.env.SECRET || 'bookhub'

const CACHE_TTL_MS = Number.parseInt(process.env.BACK_ADMIN_CACHE_TTL_MS || '10000', 10)

const cache = {
  access: { value: null, expiresAt: 0 },
}

const getCached = key => {
  const entry = cache[key]
  if (entry && entry.expiresAt > Date.now()) return entry.value
  return null
}

const setCached = (key, value) => {
  cache[key] = { value, expiresAt: Date.now() + CACHE_TTL_MS }
}

const parseBoolean = (value, fallback = true) => {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (typeof parsed === 'boolean') return parsed
    } catch (e) {
      logger.warn(`[BACK ADMIN] failed to parse boolean config: ${e.message}`)
    }
  }

  return fallback
}

const escapeHtml = value =>
  `${value || ''}`
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const isDatasphirEmail = email =>
  typeof email === 'string' && email.toLowerCase().trim().endsWith('@datasphir.com')

const normalizeEmail = email => `${email || ''}`.trim().toLowerCase()

const hashOtp = (email, otp) =>
  crypto
    .createHash('sha256')
    .update(`${OTP_SECRET}:${normalizeEmail(email)}:${`${otp}`.trim()}`)
    .digest('hex')

const createOtpCode = () =>
  String(Math.floor(100000 + Math.random() * 900000))

const createSessionToken = email => {
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000)

  const token = jwt.sign(
    {
      type: 'back-admin',
      email: normalizeEmail(email),
    },
    process.env.SECRET,
    { expiresIn: SESSION_TTL_SECONDS },
  )

  return { token, expiresAt: expiresAt.toISOString() }
}

const assertSession = sessionToken => {
  if (!sessionToken) throw new Error('Back-admin session token is required')

  let payload

  try {
    payload = jwt.verify(sessionToken, process.env.SECRET)
  } catch (e) {
    throw new Error('Back-admin session is invalid or expired')
  }

  if (!payload || payload.type !== 'back-admin' || !isDatasphirEmail(payload.email)) {
    throw new Error('Back-admin session is not authorized')
  }

  return payload
}

const countRows = async Model => {
  const result = await Model.query().count('id as count').first()
  return Number(result?.count || 0)
}

const getUserRows = async () => {
  const { result } = await User.find({}, { related: 'defaultIdentity' })
  return result
}

const getAccessConfig = async () => {
  const cached = getCached('access')
  if (cached) return cached
  const rows = await ApplicationParameter.query().where({ context: CONTEXT })
  const signInParam = rows.find(row => row.area === SIGN_IN_AREA)
  const signUpParam = rows.find(row => row.area === SIGN_UP_AREA)

  const value = {
    signInEnabled: parseBoolean(signInParam?.config, true),
    signUpEnabled: parseBoolean(signUpParam?.config, true),
  }

  setCached('access', value)
  return value
}

const upsertApplicationParameter = async (area, value) => {
  const existing = await ApplicationParameter.query().where({
    context: CONTEXT,
    area,
  }).first()

  if (!existing) {
    await ApplicationParameter.insert({
      context: CONTEXT,
      area,
      config: JSON.stringify(value),
    })
    return
  }

  await ApplicationParameter.patchAndFetchById(existing.id, {
    config: JSON.stringify(value),
  })
}

const backAdminRequestOtp = async (_, { email }) => {
  const normalizedEmail = normalizeEmail(email)

  if (!isDatasphirEmail(normalizedEmail)) {
    return {
      ok: false,
      message: 'Unauthorized: use a @datasphir.com email address.',
      expiresInSec: 0,
    }
  }

  const otp = createOtpCode()
  const now = new Date()
  const nowIso = now.toISOString()

  const expiresAtIso = new Date(
    now.getTime() + OTP_TTL_MINUTES * 60 * 1000,
  ).toISOString()

  await BackAdminOtp.query()
    .where({ email: normalizedEmail })
    .whereNull('consumedAt')
    .delete()

  await BackAdminOtp.query().insert({
    type: 'back_admin_otp',
    email: normalizedEmail,
    codeHash: hashOtp(normalizedEmail, otp),
    expiresAt: expiresAtIso,
    consumedAt: null,
    attempts: 0,
    created: nowIso,
    updated: nowIso,
  })

  const content = `
    <p>Your Bookhub back-admin OTP is:</p>
    <p style="font-size: 28px; font-weight: 700; letter-spacing: 3px;">${otp}</p>
    <p>This code expires in ${OTP_TTL_MINUTES} minutes.</p>
  `

  await enqueueEmailJobs({
    recipients: [normalizedEmail],
    subject: 'Bookhub Back-Admin OTP',
    text: `Your Bookhub back-admin OTP is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    content,
  })

  return {
    ok: true,
    message: 'OTP sent to your email.',
    expiresInSec: OTP_TTL_MINUTES * 60,
  }
}

const backAdminVerifyOtp = async (_, { email, otp }) => {
  const normalizedEmail = normalizeEmail(email)

  if (!isDatasphirEmail(normalizedEmail)) {
    throw new Error('Unauthorized email domain')
  }

  const row = await BackAdminOtp.query()
    .where({ email: normalizedEmail })
    .whereNull('consumedAt')
    .orderBy('created', 'desc')
    .first()

  if (!row) throw new Error('No OTP request found. Request a new code.')

  if (new Date(row.expiresAt).getTime() < Date.now()) {
    throw new Error('OTP expired. Request a new code.')
  }

  if ((row.attempts || 0) >= OTP_MAX_ATTEMPTS) {
    throw new Error('Too many failed attempts. Request a new code.')
  }

  const expectedHash = hashOtp(normalizedEmail, otp)

  if (expectedHash !== row.codeHash) {
    await BackAdminOtp.query().patchAndFetchById(row.id, {
      attempts: (row.attempts || 0) + 1,
      updated: new Date().toISOString(),
    })
    throw new Error('Invalid OTP code')
  }

  await BackAdminOtp.query().patchAndFetchById(row.id, {
    consumedAt: new Date().toISOString(),
    updated: new Date().toISOString(),
  })

  const session = createSessionToken(normalizedEmail)
  return {
    token: session.token,
    email: normalizedEmail,
    expiresAt: session.expiresAt,
  }
}

const backAdminValidate = async (_, { sessionToken }) => {
  assertSession(sessionToken)
  return true
}

const backAdminStats = async (_, { sessionToken }) => {
  assertSession(sessionToken)

  const [totalUsers, activeUsers, totalBooks] = await Promise.all([
    countRows(User),
    User.query().where({ isActive: true }).resultSize(),
    countRows(Book),
  ])

  return {
    totalUsers,
    activeUsers,
    totalBooks,
  }
}

const backAdminUsers = async (_, { sessionToken }) => {
  assertSession(sessionToken)
  const users = await getUserRows()
  return users
    .map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.defaultIdentity?.email || '',
      isActive: !!user.isActive,
      isVerified: !!user.defaultIdentity?.isVerified,
    }))
    .sort((a, b) => {
      const an = (a.displayName || a.username || '').toLowerCase()
      const bn = (b.displayName || b.username || '').toLowerCase()
      return an.localeCompare(bn)
    })
}

const backAdminAccess = async (_, { sessionToken }) => {
  assertSession(sessionToken)
  return getAccessConfig()
}

const publicAccessControls = async () => getAccessConfig()

const backAdminSetUserActive = async (_, { sessionToken, userId, isActive }) => {
  assertSession(sessionToken)
  const isUserAdmin = await User.hasGlobalRole(userId, 'admin')

  if (isUserAdmin && !isActive) {
    throw new Error('Cannot block a global admin user.')
  }

  await User.patchAndFetchById(userId, { isActive })
  return true
}

const backAdminLogoutUser = async (_, { sessionToken, userId }) => {
  assertSession(sessionToken)
  const isUserAdmin = await User.hasGlobalRole(userId, 'admin')

  if (isUserAdmin) {
    throw new Error('Cannot force logout a global admin user.')
  }

  try {
    await UserSession.query()
      .where({ userId })
      .whereNull('revokedAt')
      .patch({ revokedAt: new Date() })
  } catch (e) {
    throw new Error(SESSION_STORE_ERROR)
  }

  return true
}

const backAdminLogoutAll = async (_, { sessionToken, includeAdmins = false }) => {
  assertSession(sessionToken)
  const users = await getUserRows()
  const userIds = []

  await Promise.all(
    users.map(async user => {
      if (!includeAdmins) {
        const isAdmin = await User.hasGlobalRole(user.id, 'admin')
        if (isAdmin) return
      }

      userIds.push(user.id)
    }),
  )

  if (!userIds.length) return 0

  try {
    const affected = await UserSession.query()
      .whereIn('userId', userIds)
      .whereNull('revokedAt')
      .patch({ revokedAt: new Date() })

    return affected
  } catch (e) {
    throw new Error(SESSION_STORE_ERROR)
  }
}

const backAdminSendEmail = async (
  _,
  { sessionToken, subject, message, userIds = [], sendToAll = false },
) => {
  assertSession(sessionToken)
  const trimmedSubject = `${subject || ''}`.trim()
  const trimmedMessage = `${message || ''}`.trim()

  if (!trimmedSubject || !trimmedMessage) {
    throw new Error('Subject and message are required.')
  }

  const users = await getUserRows()
  const selectedIds = new Set(userIds)

  const recipients = users
    .filter(user => sendToAll || selectedIds.has(user.id))
    .map(user => user.defaultIdentity?.email)
    .filter(Boolean)

  const uniqueRecipients = [...new Set(recipients)]

  if (!uniqueRecipients.length) {
    throw new Error('No recipients found for this email.')
  }

  const htmlMessage = escapeHtml(trimmedMessage).replaceAll('\n', '<br/>')

  const queued = await enqueueEmailJobs({
    recipients: uniqueRecipients,
    subject: trimmedSubject,
    text: trimmedMessage,
    content: `<p>${htmlMessage}</p>`,
  })

  return { sent: queued, failed: 0 }
}

const backAdminEmailQueueStats = async (_, { sessionToken }) => {
  assertSession(sessionToken)

  const rows = await EmailJob.query()
    .select('status')
    .count('id as count')
    .groupBy('status')

  const counts = {
    pending: 0,
    processing: 0,
    sent: 0,
    failed: 0,
  }

  rows.forEach(row => {
    const status = `${row.status || ''}`
    const count = Number(row.count || 0)

    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] = count
    }
  })

  const total = Object.values(counts).reduce((sum, val) => sum + val, 0)

  const oldestPending = await EmailJob.query()
    .where({ status: 'pending' })
    .orderBy('created', 'asc')
    .first()

  const lastFailed = await EmailJob.query()
    .where({ status: 'failed' })
    .orderBy('updated', 'desc')
    .first()

  return {
    ...counts,
    total,
    oldestPendingAt: oldestPending ? oldestPending.created : null,
    lastFailedAt: lastFailed ? lastFailed.updated : null,
  }
}

const backAdminSetAccess = async (_, { sessionToken, signInEnabled, signUpEnabled }) => {
  assertSession(sessionToken)
  await Promise.all([
    upsertApplicationParameter(SIGN_IN_AREA, signInEnabled),
    upsertApplicationParameter(SIGN_UP_AREA, signUpEnabled),
  ])

  // Keep resolver cache in sync so backAdminAccess refetch returns the latest values immediately.
  const updatedAccess = {
    signInEnabled: !!signInEnabled,
    signUpEnabled: !!signUpEnabled,
  }

  setCached('access', updatedAccess)

  return updatedAccess
}

const backAdminInstanceHealth = async (_, { sessionToken }) => {
  assertSession(sessionToken)
  const rows = await InstanceMetric.query().orderBy('capturedAt', 'desc').limit(500)
  const latest = new Map()
  rows.forEach(row => {
    if (!latest.has(row.service)) latest.set(row.service, row)
  })

  return [...latest.values()]
    .sort((a, b) => a.service.localeCompare(b.service))
    .map(row => ({
      service: row.service,
      url: row.url,
      status: row.status,
      isHealthy: !!row.isHealthy,
      statusCode: row.statusCode,
      latencyMs: row.latencyMs,
      message: row.message,
      checkedAt: row.capturedAt,
      cpuLoad1: row.cpuLoad1,
      cpuLoad5: row.cpuLoad5,
      cpuLoad15: row.cpuLoad15,
      memoryUsedMb: row.memoryUsedMb,
      memoryTotalMb: row.memoryTotalMb,
    }))
}

const backAdminLoadSeries = async (
  _,
  { sessionToken, service = 'bookhub-runtime', minutes = 120 },
) => {
  assertSession(sessionToken)
  const boundedMinutes = Math.max(5, Math.min(minutes, 1440))
  const since = new Date(Date.now() - boundedMinutes * 60 * 1000)

  const rows = await InstanceMetric.query()
    .where({ service })
    .where('capturedAt', '>=', since)
    .orderBy('capturedAt', 'asc')

  return rows.map(row => ({
    timestamp: row.capturedAt,
    load1: row.cpuLoad1,
    load5: row.cpuLoad5,
    load15: row.cpuLoad15,
    memoryUsedMb: row.memoryUsedMb,
    memoryTotalMb: row.memoryTotalMb,
  }))
}

const backAdminInstanceLogs = async (_, { sessionToken, service = null, limit = 100 }) => {
  assertSession(sessionToken)
  const boundedLimit = Math.max(10, Math.min(limit, 500))
  let query = InstanceMetric.query().orderBy('capturedAt', 'desc').limit(boundedLimit)

  if (service) {
    query = query.where({ service })
  }

  const rows = await query
  return rows.map(row => ({
    id: row.id,
    service: row.service,
    status: row.status,
    message: row.message,
    checkedAt: row.capturedAt,
    statusCode: row.statusCode,
    latencyMs: row.latencyMs,
  }))
}

const backAdminThothStatus = async (_, { sessionToken }) => {
  assertSession(sessionToken)
  return getThothStatus()
}

const backAdminThothWorks = async (
  _,
  {
    sessionToken,
    environment = null,
    search = '',
    publisherOnly = false,
    syncedOnly = false,
    page = 1,
    pageSize = 20,
  },
) => {
  assertSession(sessionToken)

  return getThothWorks({
    environment,
    search,
    publisherOnly,
    syncedOnly,
    page,
    pageSize,
  })
}

const backAdminThothWork = async (_, { sessionToken, environment = null, workId }) => {
  assertSession(sessionToken)
  return getThothWork({ environment, workId })
}

module.exports = {
  Query: {
    backAdminValidate,
    backAdminStats,
    backAdminUsers,
    backAdminAccess,
    backAdminEmailQueueStats,
    backAdminInstanceHealth,
    backAdminLoadSeries,
    backAdminInstanceLogs,
    backAdminThothStatus,
    backAdminThothWorks,
    backAdminThothWork,
    publicAccessControls,
  },
  Mutation: {
    backAdminRequestOtp,
    backAdminVerifyOtp,
    backAdminSetUserActive,
    backAdminLogoutUser,
    backAdminLogoutAll,
    backAdminSendEmail,
    backAdminSetAccess,
  },
}
