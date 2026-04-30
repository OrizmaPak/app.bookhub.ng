const { logger } = require('@coko/server')
const {
  notify,
  notificationTypes: { EMAIL },
} = require('@coko/server/src//services')

const { models } = require('../models')

const { EmailJob } = models

const getInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const MAX_ATTEMPTS = getInt(process.env.EMAIL_QUEUE_MAX_ATTEMPTS, 3)
const BATCH_SIZE = getInt(process.env.EMAIL_QUEUE_BATCH_SIZE, 50)
const LOCK_TIMEOUT_MS = getInt(process.env.EMAIL_QUEUE_LOCK_TIMEOUT_MS, 300000)

const enqueueEmailJobs = async ({ recipients, subject, text, content }) => {
  if (!recipients || recipients.length === 0) return 0

  const now = new Date()
  const nowIso = now.toISOString()
  const rows = recipients.map(email => ({
    type: 'emailJob',
    to: email,
    subject,
    text,
    content,
    status: 'pending',
    attempts: 0,
    created: nowIso,
    updated: nowIso,
  }))

  await EmailJob.query().insert(rows)
  return rows.length
}

const claimJobs = async () => {
  const now = new Date()
  const nowIso = now.toISOString()
  const lockExpiredBefore = new Date(Date.now() - LOCK_TIMEOUT_MS)

  const jobs = await EmailJob.query()
    .where('status', 'pending')
    .where(builder => {
      builder.whereNull('lockedAt').orWhere('lockedAt', '<', lockExpiredBefore)
    })
    .where(builder => {
      builder.whereNull('scheduledAt').orWhere('scheduledAt', '<=', now)
    })
    .orderBy('created', 'asc')
    .limit(BATCH_SIZE)

  if (!jobs.length) return []

  await Promise.all(
    jobs.map(job =>
      EmailJob.query().findById(job.id).patch({
        status: 'processing',
        lockedAt: nowIso,
        updated: nowIso,
      }),
    ),
  )

  return jobs
}

const processEmailQueue = async () => {
  const jobs = await claimJobs()
  if (!jobs.length) return { processed: 0, sent: 0, failed: 0 }

  let sent = 0
  let failed = 0

  await Promise.all(
    jobs.map(async job => {
      try {
        await notify(EMAIL, {
          to: job.to,
          subject: job.subject,
          text: job.text,
          content: job.content,
        })

        await EmailJob.query().findById(job.id).patch({
          status: 'sent',
          sentAt: new Date().toISOString(),
          lockedAt: null,
          lastError: null,
          updated: new Date().toISOString(),
        })

        sent += 1
      } catch (e) {
        const attempts = (job.attempts || 0) + 1
        const terminal = attempts >= MAX_ATTEMPTS
        const nextStatus = terminal ? 'failed' : 'pending'

        await EmailJob.query().findById(job.id).patch({
          status: nextStatus,
          attempts,
          lockedAt: null,
          lastError: e.message || String(e),
          updated: new Date().toISOString(),
        })

        failed += 1
        logger.warn(`[EMAIL QUEUE] failed to send email to ${job.to}: ${e.message}`)
      }
    }),
  )

  return { processed: jobs.length, sent, failed }
}

module.exports = {
  enqueueEmailJobs,
  processEmailQueue,
}
