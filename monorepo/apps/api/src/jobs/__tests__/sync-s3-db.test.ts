import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { File as FileType } from '@file-manager/types';
import { S3DBSyncJob } from '../sync-s3-db';
import { s3Service } from '../../services/s3';
import { prisma } from '../../db';
import { publishFileDeletedEvent } from '../../services/kafka';
import { logger } from '../../utils/logger';

// Mock the services
jest.mock('../../services/s3');
jest.mock('../../db');
jest.mock('../../services/kafka');
jest.mock('../../utils/logger');

// Mock events storage
const mockEvents: any[] = [];
const clearMockEvents = () => {
  mockEvents.length = 0;
  (publishFileDeletedEvent as jest.Mock).mockClear();
};

describe('S3DBSyncJob', () => {
  let syncJob: S3DBSyncJob;
  const mockS3Service = s3Service as jest.Mocked<typeof s3Service>;
  const mockPrisma = prisma as jest.Mocked<typeof prisma>;

  beforeEach(() => {
    syncJob = new S3DBSyncJob();
    clearMockEvents();
    jest.clearAllMocks();
  });

  describe('start', () => {
    it('should handle no discrepancies', async () => {
      // Setup mock data
      const mockFiles: FileType[] = [
        {
          id: 'files/image/123-test.jpg',
          name: 'test.jpg',
          originalName: 'test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          url: 'http://localhost:9000/files/files/image/123-test.jpg',
          uploadedBy: 'test',
          createdAt: new Date(),
          previewUrl: null,
          updatedAt: new Date()
        }
      ];

      const mockDbFiles = [
        {
          id: 'db-1',
          name: 'test.jpg',
          originalName: 'test.jpg',
          url: 'http://localhost:9000/files/files/image/123-test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          uploadedBy: 'test',
          previewUrl: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Setup mocks
      mockS3Service.listFiles.mockResolvedValue(mockFiles);
      mockPrisma.file.findMany.mockResolvedValue(mockDbFiles);

      // Run the sync
      await syncJob.start();

      // Verify no changes were made
      expect(mockPrisma.file.create).not.toHaveBeenCalled();
      expect(mockPrisma.file.delete).not.toHaveBeenCalled();
      expect(publishFileDeletedEvent).not.toHaveBeenCalled();
      expect(mockEvents).toHaveLength(0);
    });

    it('should handle files missing in DB', async () => {
      // Setup mock data
      const mockFiles: FileType[] = [
        {
          id: 'files/image/123-test.jpg',
          name: 'test.jpg',
          originalName: 'test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          url: 'http://localhost:9000/files/files/image/123-test.jpg',
          uploadedBy: 'test',
          createdAt: new Date(),
          previewUrl: null,
          updatedAt: new Date()
        }
      ];

      // Setup mocks
      mockS3Service.listFiles.mockResolvedValue(mockFiles);
      mockPrisma.file.findMany.mockResolvedValue([]);
      mockPrisma.file.create.mockResolvedValue({
        ...mockFiles[0],
        id: 'new-db-1',
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Run the sync
      await syncJob.start();

      // Verify DB record was created
      expect(mockPrisma.file.create).toHaveBeenCalledWith({
        data: {
          name: 'test.jpg',
          originalName: 'test.jpg',
          url: 'http://localhost:9000/files/files/image/123-test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          uploadedBy: 'system-sync',
        }
      });
    });

    it('should handle files missing in S3', async () => {
      // Setup mock data
      const mockDbFiles = [
        {
          id: 'db-1',
          name: 'missing.jpg',
          originalName: 'missing.jpg',
          url: 'http://localhost:9000/files/files/image/123-missing.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          uploadedBy: 'test',
          previewUrl: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      // Setup mocks
      mockS3Service.listFiles.mockResolvedValue([]);
      mockPrisma.file.findMany.mockResolvedValue(mockDbFiles);
      mockPrisma.file.delete.mockResolvedValue(mockDbFiles[0]);

      // Run the sync
      await syncJob.start();

      // Verify DB record was deleted
      expect(mockPrisma.file.delete).toHaveBeenCalledWith({
        where: { id: 'db-1' }
      });

      // Verify delete event was published
      expect(publishFileDeletedEvent).toHaveBeenCalledWith({
        fileId: 'db-1',
        fileName: 'missing.jpg',
        deletedBy: 'system-sync'
      });
    });

    it('should handle concurrent runs', async () => {
      // Setup mocks
      mockS3Service.listFiles.mockResolvedValue([]);
      mockPrisma.file.findMany.mockResolvedValue([]);

      // Start two concurrent runs
      const firstRun = syncJob.start();
      const secondRun = syncJob.start();

      // Wait for both to complete
      await Promise.all([firstRun, secondRun]);

      // Verify services were only called once
      expect(mockS3Service.listFiles).toHaveBeenCalledTimes(1);
      expect(mockPrisma.file.findMany).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith('Sync job is already running, skipping this iteration');
    });

    it('should handle errors gracefully', async () => {
      // Setup mocks to throw errors
      mockS3Service.listFiles.mockRejectedValue(new Error('S3 error'));

      // Run the sync
      await syncJob.start();

      // Verify error was logged
      expect(logger.error).toHaveBeenCalledWith('Error in S3↔DB sync job:', expect.any(Error));

      // Verify the job can be run again
      mockS3Service.listFiles.mockResolvedValue([]);
      mockPrisma.file.findMany.mockResolvedValue([]);

      await syncJob.start();

      expect(mockS3Service.listFiles).toHaveBeenCalledTimes(2);
    });
  });
}); 