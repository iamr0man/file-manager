import { s3Service } from '../services/s3';
import { prisma } from '../db';
import { publishFileDeletedEvent } from '../services/kafka';
import { DEFAULT_CONFIG } from '../services/s3';
import { logger } from '../utils/logger';
import type { File as FileType } from '@file-manager/types';

interface DBFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

export class S3DBSyncJob {
  private isRunning = false;

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Sync job is already running, skipping this iteration');
      return;
    }

    try {
      this.isRunning = true;
      logger.info('Starting S3↔DB sync job');

      // Get all files from S3
      const s3Files = await this.listS3Files();
      logger.info(`Found ${s3Files.length} files in S3`);

      // Get all files from DB
      const dbFiles = await this.listDBFiles();
      logger.info(`Found ${dbFiles.length} files in DB`);

      // Find discrepancies
      const { missingInDB, missingInS3 } = this.findDiscrepancies(s3Files, dbFiles);

      // Handle files missing in DB
      if (missingInDB.length > 0) {
        logger.info(`Found ${missingInDB.length} files in S3 that are missing in DB`);
        await this.handleMissingInDB(missingInDB);
      }

      // Handle files missing in S3
      if (missingInS3.length > 0) {
        logger.info(`Found ${missingInS3.length} files in DB that are missing in S3`);
        await this.handleMissingInS3(missingInS3);
      }

      logger.info('S3↔DB sync job completed successfully');
    } catch (error) {
      logger.error('Error in S3↔DB sync job:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined
      });
      console.error('Full sync job error:', error);
      throw error; // Re-throw to propagate to caller
    } finally {
      this.isRunning = false;
    }
  }

  private async listS3Files(): Promise<FileType[]> {
    return await s3Service.listFiles();
  }

  private async listDBFiles(): Promise<DBFile[]> {
    return await prisma.file.findMany({
      select: {
        id: true,
        name: true,
        url: true,
        size: true,
        mimeType: true
      }
    });
  }

  private findDiscrepancies(s3Files: FileType[], dbFiles: DBFile[]) {
    const s3Keys = new Set(s3Files.map(f => f.id)); // S3 service returns file.Key as id
    const dbUrls = new Set(dbFiles.map(f => this.getKeyFromUrl(f.url)));

    const missingInDB = s3Files.filter(s3File => 
      !dbUrls.has(s3File.id)
    );

    const missingInS3 = dbFiles.filter(dbFile => 
      !s3Keys.has(this.getKeyFromUrl(dbFile.url))
    );

    return { missingInDB, missingInS3 };
  }

  private getKeyFromUrl(url: string): string {
    const prefix = `${DEFAULT_CONFIG.endpoint}/${DEFAULT_CONFIG.bucket}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : url;
  }

  private getMimeTypeFromKey(key: string): string {
    const parts = key.split('/');
    return parts.length > 1 ? parts[0] : 'application/octet-stream';
  }

  private getNameFromKey(key: string): string {
    const parts = key.split('/');
    return parts[parts.length - 1];
  }

  private async handleMissingInDB(missingFiles: FileType[]): Promise<void> {
    for (const file of missingFiles) {
      try {
        await prisma.file.create({
          data: {
            name: file.name,
            originalName: file.originalName,
            url: file.url,
            size: file.size,
            mimeType: file.mimeType,
            uploadedBy: 'system-sync',
          }
        });
        logger.info(`Created DB record for S3 file: ${file.id}`);
      } catch (error) {
        logger.error(`Failed to create DB record for S3 file ${file.id}:`, error);
      }
    }
  }

  private async handleMissingInS3(missingFiles: DBFile[]): Promise<void> {
    for (const file of missingFiles) {
      try {
        // Delete DB record
        await prisma.file.delete({
          where: { id: file.id }
        });

        // Publish delete event
        await publishFileDeletedEvent({
          fileId: file.id,
          fileName: file.name,
          deletedBy: 'system-sync'
        });

        logger.info(`Deleted DB record for missing S3 file: ${file.name}`);
      } catch (error) {
        logger.error(`Failed to delete DB record for missing S3 file ${file.name}:`, error);
      }
    }
  }
} 