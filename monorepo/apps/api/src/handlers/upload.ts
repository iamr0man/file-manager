import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { fileRouter } from '../trpc/router';
import { validateFile, validateFiles, sanitizeFilename } from '../utils/validation';

// Create caller for tRPC
const trpcCaller = fileRouter.createCaller({});

// Types for request body
interface SingleUploadQuery {
  uploadedBy?: string;
}

interface BatchUploadQuery {
  uploadedBy?: string;
}

// Single file upload handler
export const singleUploadHandler = async (
  request: FastifyRequest<{ Querystring: { uploadedBy?: string } }>,
  reply: FastifyReply
) => {
  try {
    // Get file from multipart
    const file = await request.file();
    
    if (!file) {
      return reply.status(400).send({
        success: false,
        error: 'No file provided',
        code: 'NO_FILE',
      });
    }

    // Read file into buffer
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const { uploadedBy = 'system' } = request.query;

    // Prepare data for validation
    const fileData = {
      filename: sanitizeFilename(file.filename),
      mimetype: file.mimetype,
      size: buffer.length,
      buffer,
    };

    // Validate file
    const validation = validateFile(fileData);
    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: validation.error,
        code: validation.code,
      });
    }

    try {
      // Upload file using tRPC mutation
      const result = await trpcCaller.upload({
        name: fileData.filename,
        originalName: file.filename,
        size: fileData.size,
        mimeType: fileData.mimetype,
        uploadedBy,
        fileBuffer: buffer,
      });

        if (!result.success) {
          throw new Error(result.error || 'Upload failed');
        }

      return reply.send({
        success: true,
        file: result.data,
      });

    } catch (uploadError) {
      return reply.status(500).send({
        success: false,
        error: uploadError instanceof Error ? uploadError.message : 'Upload failed',
        code: 'UPLOAD_FAILED',
      });
    }

  } catch (error) {
    console.error('Single upload handler error:', error);
    return reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
};

// Batch file upload handler
export const batchUploadHandler = async (
  request: FastifyRequest<{ Querystring: { uploadedBy?: string } }>,
  reply: FastifyReply
) => {
  try {
    // Get all files from multipart
    const files = request.files();
    const fileArray: Array<{
      data: MultipartFile;
      buffer: Buffer;
    }> = [];

    // Read all files into memory
    for await (const file of files) {
      const chunks: Buffer[] = [];
      for await (const chunk of file.file) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      fileArray.push({ data: file, buffer });
    }

    if (fileArray.length === 0) {
      return reply.status(400).send({
        success: false,
        error: 'No files provided',
        code: 'NO_FILES',
      });
    }

    const { uploadedBy = 'system' } = request.query;

    // Prepare data for validation
    const fileDataArray = fileArray.map(({ data, buffer }) => ({
      filename: sanitizeFilename(data.filename),
      mimetype: data.mimetype,
      size: buffer.length,
      buffer,
      originalFilename: data.filename,
    }));

    // Check if we have too many files
    if (fileDataArray.length > 10) {
      return reply.status(400).send({
        success: false,
        error: `Too many files. Maximum 10 allowed`,
        code: 'TOO_MANY_FILES',
      });
    }

    // Process each file individually - validate and upload valid files, skip invalid ones
    const results = await Promise.all(
      fileDataArray.map(async (fileData) => {
        try {
          // Validate individual file
          const validation = validateFile(fileData);
          if (!validation.success) {
            return {
              success: false,
              filename: fileData.originalFilename,
              file: null,
              error: validation.error,
              skipped: true,
            };
          }

          // Upload file using tRPC mutation
          const result = await trpcCaller.upload({
            name: fileData.filename,
            originalName: fileData.originalFilename,
            size: fileData.size,
            mimeType: fileData.mimetype,
            uploadedBy,
            fileBuffer: fileData.buffer,
          });

          return {
            success: result.success,
            filename: fileData.originalFilename,
            file: result.success ? result.data : null,
            error: !result.success ? (result as any).error || 'Upload failed' : null,
            skipped: false,
          };
        } catch (error) {
          console.error(`Failed to upload ${fileData.originalFilename}:`, error);
          return {
            success: false,
            filename: fileData.originalFilename,
            file: null,
            error: error instanceof Error ? error.message : 'Upload failed',
            skipped: false,
          };
        }
      })
    );

    // Calculate overall success
    const successfulFiles = results.filter((result) => result.success);
    const failedFiles = results.filter((result) => !result.success && !result.skipped);
    const skippedFiles = results.filter((result) => result.skipped);
    const hasAnySuccess = successfulFiles.length > 0;

    return reply.send({
      success: hasAnySuccess, // Success if at least one file was uploaded
      totalFiles: results.length,
      successfulFiles: successfulFiles.length,
      failedFiles: failedFiles.length,
      skippedFiles: skippedFiles.length,
      files: results.map((result) => ({
        filename: result.filename,
        success: result.success,
        file: result.file,
        error: result.error,
        skipped: result.skipped || false,
      })),
    });

  } catch (error) {
    console.error('Batch upload handler error:', error);
    return reply.status(500).send({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
      code: 'INTERNAL_ERROR',
    });
  }
}; 