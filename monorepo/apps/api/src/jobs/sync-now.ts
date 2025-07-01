import { S3DBSyncJob } from './sync-s3-db';
import { logger } from '../utils/logger';

async function runSyncNow() {
  logger.info('Starting immediate S3↔DB sync');
  
  const syncJob = new S3DBSyncJob();
  
  try {
    await syncJob.start();
    logger.info('Immediate S3↔DB sync completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Immediate S3↔DB sync failed:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    console.error('Full error details:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('Received SIGTERM signal, exiting');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Received SIGINT signal, exiting');
  process.exit(0);
});

// Run the sync immediately
runSyncNow(); 