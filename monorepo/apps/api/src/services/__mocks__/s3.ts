import { jest } from '@jest/globals';
import type { File as FileType } from '@file-manager/types';

export const DEFAULT_CONFIG = {
  endpoint: 'http://localhost:9000',
  bucket: 'files',
  region: 'us-east-1',
  credentials: {
    accessKeyId: 'test',
    secretAccessKey: 'test',
  },
  forcePathStyle: true,
};

export const s3Service = {
  listFiles: jest.fn(),
  uploadFile: jest.fn(),
  deleteFile: jest.fn(),
  getSignedUrl: jest.fn(),
  ensureBucketExists: jest.fn(),
}; 