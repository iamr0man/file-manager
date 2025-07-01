import { CronJob } from 'cron';
import { S3DBSyncJob } from './sync-s3-db';
import { logger } from '../utils/logger';

const SYNC_SCHEDULE = process.env.SYNC_SCHEDULE || '0 * * * *'; // Every hour by default

const syncJob = new S3DBSyncJob();

// Create a cron job
const job = new CronJob(
  SYNC_SCHEDULE,
  async () => {
    try {
      await syncJob.start();
    } catch (error) {
      logger.error('Failed to run sync job:', error);
    }
  },
  null, // onComplete
  true, // start
  'UTC' // timeZone
);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, stopping sync job');
  job.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal, stopping sync job');
  job.stop();
  process.exit(0);
});

// Start the job
logger.info(`Starting S3↔DB sync job with schedule: ${SYNC_SCHEDULE}`);
job.start(); 