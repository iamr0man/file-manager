import { FastifyRequest, FastifyReply } from 'fastify';
import { MultipartFile } from '@fastify/multipart';
import { fileRouter } from '../trpc/router';
import { validateFile, validateFiles, sanitizeFilename } from '../utils/validation';

// Создаем caller для tRPC
const trpcCaller = fileRouter.createCaller({});

// Типы для request body
interface SingleUploadQuery {
  uploadedBy?: string;
}

interface BatchUploadQuery {
  uploadedBy?: string;
}

// Обработчик одиночной загрузки файла
export const singleUploadHandler = async (
  request: FastifyRequest<{ Querystring: { uploadedBy?: string } }>,
  reply: FastifyReply
) => {
  try {
    // Получаем файл из multipart
    const file = await request.file();
    
    if (!file) {
      return reply.status(400).send({
        success: false,
        error: 'No file provided',
        code: 'NO_FILE',
      });
    }

    // Читаем файл в буфер
    const chunks: Buffer[] = [];
    for await (const chunk of file.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const { uploadedBy = 'system' } = request.query;

    // Подготавливаем данные для валидации
    const fileData = {
      filename: sanitizeFilename(file.filename),
      mimetype: file.mimetype,
      size: buffer.length,
      buffer,
    };

    // Валидируем файл
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

// Обработчик мультизагрузки файлов
export const batchUploadHandler = async (
  request: FastifyRequest<{ Querystring: { uploadedBy?: string } }>,
  reply: FastifyReply
) => {
  try {
    // Получаем все файлы из multipart
    const files = request.files();
    const fileArray: Array<{
      data: MultipartFile;
      buffer: Buffer;
    }> = [];

    // Читаем все файлы в память
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

    // Подготавливаем данные для валидации
    const fileDataArray = fileArray.map(({ data, buffer }) => ({
      filename: sanitizeFilename(data.filename),
      mimetype: data.mimetype,
      size: buffer.length,
      buffer,
    }));

    // Валидируем все файлы сразу
    const validation = validateFiles(fileDataArray);
    if (!validation.success) {
      return reply.status(400).send({
        success: false,
        error: validation.error,
        code: validation.code,
      });
    }

    // Process each file
    const results = await Promise.all(
      fileDataArray.map(async (fileData) => {
        try {
          // Upload file using tRPC mutation
          const result = await trpcCaller.upload({
            name: fileData.filename,
            originalName: fileData.filename,
            size: fileData.size,
            mimeType: fileData.mimetype,
            uploadedBy,
            fileBuffer: fileData.buffer,
          });

          return {
            success: result.success,
            filename: fileData.filename,
            file: result.success ? result.data : null,
            error: !result.success ? result.error : null,
          };
        } catch (error) {
          console.error(`Failed to upload ${fileData.filename}:`, error);
          return {
            success: false,
            filename: fileData.filename,
            file: null,
            error: error instanceof Error ? error.message : 'Upload failed',
          };
        }
      })
    );

    // Calculate overall success
    const allSuccessful = results.every((result) => result.success);
    const successfulFiles = results.filter((result) => result.success);
    const failedFiles = results.filter((result) => !result.success);

    return reply.send({
      success: allSuccessful,
      totalFiles: results.length,
      successfulFiles: successfulFiles.length,
      failedFiles: failedFiles.length,
      files: results.map((result) => ({
        filename: result.filename,
        success: result.success,
        file: result.file,
        error: result.error,
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