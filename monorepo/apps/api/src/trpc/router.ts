import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { prisma } from '../db';
import { s3Service, extractKeyFromUrl, getPreviewUrl, DEFAULT_CONFIG } from '../services/s3';
import { publishFileUploadedEvent, publishFileDeletedEvent } from '../services/kafka';
import { 
  FileCreateSchema, 
  FileSchema,
  ApiSuccess,
  ApiError,
  File as FileType,
  FileDownloadUrlResponse
} from '@file-manager/types';

// Initialize tRPC
const t = initTRPC.create();

// Export router and procedures
export const router = t.router;
export const publicProcedure = t.procedure;

// File router
export const fileRouter = router({
  // File upload
  upload: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      originalName: z.string().min(1).max(255),
      size: z.number().int().min(1).max(200 * 1024 * 1024), // 200MB
      mimeType: z.string().min(1),
      uploadedBy: z.string().min(1),
      fileBuffer: z.instanceof(Buffer), // File buffer
    }))
    .mutation(async ({ input }): Promise<ApiSuccess<FileType> | ApiError> => {
      try {
        // 1. Upload file to S3
        const { key } = await s3Service.uploadFile(
          input.fileBuffer,
          input.mimeType,
          input.originalName
        );

        const url = `${DEFAULT_CONFIG.endpoint}/${DEFAULT_CONFIG.bucket}/${key}`;

        // 2. Save metadata to DB
        const fileRecord = await prisma.file.create({
          data: {
            name: input.name,
            originalName: input.originalName,
            url: url,
            size: input.size,
            mimeType: input.mimeType,
            uploadedBy: input.uploadedBy,
            previewUrl: null,
          },
        });

        // 3. Publish event to Kafka
        await publishFileUploadedEvent({
          fileId: fileRecord.id,
          fileName: fileRecord.name,
          fileSize: fileRecord.size,
          mimeType: fileRecord.mimeType,
          uploadedBy: fileRecord.uploadedBy,
          url: fileRecord.url,
        });

        return {
          success: true,
          data: {
            ...fileRecord,
            previewUrl: null,
          },
          message: 'File uploaded successfully',
        };
      } catch (error) {
        console.error('Upload error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to upload file',
          code: 'UPLOAD_ERROR',
        };
      }
    }),

  // Get file list
  list: publicProcedure
    .input(z.object({
      uploadedBy: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }).optional())
    .query(async ({ input }): Promise<ApiSuccess<(FileType & { previewUrl: string | null })[]> | ApiError> => {
      try {
        const files = await prisma.file.findMany({
          where: input?.uploadedBy ? { uploadedBy: input.uploadedBy } : undefined,
          orderBy: { createdAt: 'desc' },
          take: input?.limit ?? 50,
          skip: input?.offset ?? 0,
        });

        // Generate preview URLs for supported files
        const filesWithPreviews = await Promise.all(
          files.map(async (file: { id: string; name: string; originalName: string; url: string; size: number; mimeType: string; uploadedBy: string; createdAt: Date; updatedAt: Date; previewUrl: string | null }) => {
            const s3Key = extractKeyFromUrl(file.url);
            const previewUrl = await getPreviewUrl(s3Key, file.mimeType);
            return {
              ...file,
              previewUrl,
              createdAt: file.createdAt.toISOString(),
              updatedAt: file.updatedAt.toISOString(),
            };
          })
        );

        return {
          success: true,
          data: filesWithPreviews,
        };
      } catch (error) {
        console.error('Failed to list files:', error);
        return {
          success: false,
          error: 'Failed to list files',
          code: 'LIST_ERROR',
        };
      }
    }),

  // Delete file
  delete: publicProcedure
    .input(z.object({
      id: z.string().cuid(),
      deletedBy: z.string().min(1),
    }))
    .mutation(async ({ input }): Promise<ApiSuccess<{ id: string; deleted: boolean }> | ApiError> => {
      try {
        // 1. Find the file in DB
        const fileRecord = await prisma.file.findUnique({
          where: { id: input.id },
        });

        if (!fileRecord) {
          return {
            success: false,
            error: 'File not found',
            code: 'FILE_NOT_FOUND',
          };
        }

        // 2. Delete file from S3
        const s3Key = extractKeyFromUrl(fileRecord.url);
        await s3Service.deleteFile(s3Key);

        // 3. Delete record from DB
        await prisma.file.delete({
          where: { id: input.id },
        });

        // 4. Publish event to Kafka
        await publishFileDeletedEvent({
          fileId: fileRecord.id,
          fileName: fileRecord.name,
          deletedBy: input.deletedBy,
        });

        return {
          success: true,
          data: {
            id: input.id,
            deleted: true,
          },
          message: 'File deleted successfully',
        };
      } catch (error) {
        console.error('Failed to delete file:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete file',
          code: 'DELETE_ERROR',
        };
      }
    }),

  // Get file information
  getById: publicProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .query(async ({ input }): Promise<ApiSuccess<FileType | null> | ApiError> => {
      try {
        const file = await prisma.file.findUnique({
          where: { id: input.id },
        });

        return {
          success: true,
          data: file ? {
            ...file,
            previewUrl: null,
            createdAt: file.createdAt.toISOString(),
            updatedAt: file.updatedAt.toISOString(),
          } : null,
        };
      } catch (error) {
        console.error('Get file error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get file',
          code: 'GET_ERROR',
        };
      }
    }),

  // Get download URL for file
  getDownloadUrl: publicProcedure
    .input(z.object({
      id: z.string().cuid(),
    }))
    .query(async ({ input }): Promise<FileDownloadUrlResponse | ApiError> => {
      try {
        const file = await prisma.file.findUnique({
          where: { id: input.id },
        });

        if (!file) {
          return {
            success: false,
            error: 'File not found',
            code: 'FILE_NOT_FOUND',
          };
        }

        // Extract S3 key from the stored URL
        const s3Key = extractKeyFromUrl(file.url);
        
        // Generate signed URL for download (expires in 5 minutes)
        const downloadUrl = await s3Service.getSignedUrl(s3Key, 300);

        return {
          success: true,
          data: {
            url: downloadUrl,
          },
        };
      } catch (error) {
        console.error('Get download URL error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate download URL',
          code: 'DOWNLOAD_URL_ERROR',
        };
      }
    }),
});

export type AppRouter = typeof fileRouter; 