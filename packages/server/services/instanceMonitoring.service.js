const http = require('http')
const https = require('https')
const os = require('os')
const { logger } = require('@coko/server')
const { models } = require('../models')

const { InstanceMetric } = models

const getInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

const CHECK_TIMEOUT_MS = getInt(process.env.INSTANCE_CHECK_TIMEOUT_MS, 4000)
const RETENTION_DAYS = getInt(process.env.INSTANCE_METRIC_RETENTION_DAYS, 14)

const bytesToMb = value => Number((value / (1024 * 1024)).toFixed(2))

const serviceTargets = () => {
  const targets = [
    { service: 'bookhub-server', url: process.env.SERVER_URL || null },
    { service: 'bookhub-client', url: process.env.CLIENT_URL || null },
    { service: 'xsweet', url: process.env.SERVICE_XSWEET_URL || null },
    { service: 'pagedjs', url: process.env.SERVICE_PAGEDJS_URL || null },
    { service: 'epubchecker', url: process.env.SERVICE_EPUB_CHECKER_URL || null },
    { service: 'flax', url: process.env.SERVICE_FLAX_URL || null },
  ]

  return targets.filter(target => target.url)
}

const probeUrl = urlString =>
  new Promise(resolve => {
    try {
      const start = Date.now()
      const url = new URL(urlString)
      const transport = url.protocol === 'https:' ? https : http

      const req = transport.request(
        {
          method: 'GET',
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || undefined,
          path: url.pathname || '/',
          timeout: CHECK_TIMEOUT_MS,
        },
        res => {
          res.resume()
          const latencyMs = Date.now() - start
          const statusCode = Number(res.statusCode || 0)
          const isHealthy = statusCode > 0 && statusCode < 500

          resolve({
            isHealthy,
            status: isHealthy ? 'healthy' : 'unhealthy',
            statusCode,
            latencyMs,
            message: `HTTP ${statusCode}`,
          })
        },
      )

      req.on('timeout', () => {
        req.destroy(new Error('timeout'))
      })

      req.on('error', error => {
        const latencyMs = Date.now() - start
        resolve({
          isHealthy: false,
          status: 'unhealthy',
          statusCode: null,
          latencyMs,
          message: error.message,
        })
      })

      req.end()
    } catch (error) {
      resolve({
        isHealthy: false,
        status: 'unhealthy',
        statusCode: null,
        latencyMs: null,
        message: error.message,
      })
    }
  })

const recordMetrics = async snapshots => {
  if (!snapshots.length) return
  await InstanceMetric.query().insert(snapshots)
}

const pruneOldMetrics = async () => {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000)
  await InstanceMetric.query().where('capturedAt', '<', cutoff).delete()
}

const collectInstanceMetrics = async () => {
  const now = new Date()
  const nowIso = now.toISOString()
  const [load1, load5, load15] = os.loadavg()
  const memoryTotalMb = bytesToMb(os.totalmem())
  const memoryUsedMb = bytesToMb(os.totalmem() - os.freemem())

  const snapshots = [
    {
      type: 'instance_metric',
      service: 'bookhub-runtime',
      url: null,
      status: 'healthy',
      isHealthy: true,
      statusCode: null,
      latencyMs: null,
      message: 'Runtime snapshot',
      cpuLoad1: Number(load1.toFixed(3)),
      cpuLoad5: Number(load5.toFixed(3)),
      cpuLoad15: Number(load15.toFixed(3)),
      memoryUsedMb,
      memoryTotalMb,
      capturedAt: nowIso,
      created: nowIso,
      updated: nowIso,
    },
  ]

  const targets = serviceTargets()

  const checks = await Promise.all(
    targets.map(async target => {
      const result = await probeUrl(target.url)
      return {
        type: 'instance_metric',
        service: target.service,
        url: target.url,
        status: result.status,
        isHealthy: result.isHealthy,
        statusCode: result.statusCode,
        latencyMs: result.latencyMs,
        message: result.message,
        cpuLoad1: Number(load1.toFixed(3)),
        cpuLoad5: Number(load5.toFixed(3)),
        cpuLoad15: Number(load15.toFixed(3)),
        memoryUsedMb,
        memoryTotalMb,
        capturedAt: nowIso,
        created: nowIso,
        updated: nowIso,
      }
    }),
  )

  snapshots.push(...checks)

  await recordMetrics(snapshots)
  await pruneOldMetrics()

  const unhealthy = checks.filter(item => !item.isHealthy)
  if (unhealthy.length) {
    logger.warn(
      `[INSTANCE MONITOR] unhealthy services: ${unhealthy
        .map(item => `${item.service} (${item.message || 'unknown'})`)
        .join(', ')}`,
    )
  }

  return {
    checked: checks.length,
    unhealthy: unhealthy.length,
  }
}

module.exports = {
  collectInstanceMetrics,
}
