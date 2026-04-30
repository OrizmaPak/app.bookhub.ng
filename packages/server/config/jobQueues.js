/* eslint-disable global-require */

let tempDirectoryCleanUp

try {
  tempDirectoryCleanUp = JSON.parse(process.env.TEMP_DIRECTORY_CLEAN_UP)
} catch (e) {
  tempDirectoryCleanUp = false
}

module.exports = [
  {
    name: 'email-queue',
    handler: async () => {
      const { processEmailQueue } = require('../services/emailQueue.service')
      await processEmailQueue()
    },
    schedule: process.env.EMAIL_QUEUE_SCHEDULE || '*/1 * * * *',
  },
  {
    name: 'instance-health-monitor',
    handler: async () => {
      const { collectInstanceMetrics } = require('../services/instanceMonitoring.service')
      await collectInstanceMetrics()
    },
    schedule: process.env.INSTANCE_HEALTH_MONITOR_SCHEDULE || '*/1 * * * *',
  },
  {
    name: 'clean-idle-locks',
    handler: async () => {
      const { cleanUpIdleLocks } = require('../services/cron.service')
      await cleanUpIdleLocks()
    },
    schedule: '*/10 * * * *',
  },
  tempDirectoryCleanUp && {
    name: 'temp-directory-cleanup',
    handler: async () => {
      const { tempDirectoryCleanup } = require('../services/cron.service')
      await tempDirectoryCleanup()
    },
    schedule: process.env.TEMP_DIRECTORY_CRON_JOB_SCHEDULE || '0 * * * *',
  },
].filter(Boolean)
