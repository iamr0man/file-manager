import { z } from 'zod';

// Схема конфигурации S3
export const S3ConfigSchema = z.object({
  endpoint: z.string().default('http://localhost:9000'),
  region: z.string().default('us-east-1'),
  accessKeyId: z.string().default('minioadmin'),
  secretAccessKey: z.string().default('minioadmin'),
  bucket: z.string().default('files'),
  forcePathStyle: z.boolean().default(true), // для MinIO
});

export type S3Config = z.infer<typeof S3ConfigSchema>;

// Функция для получения конфигурации S3
export const getS3Config = (): S3Config => {
  return S3ConfigSchema.parse({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    bucket: process.env.S3_BUCKET,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false', // Default to true for MinIO
  });
};

// Функция для получения публичного URL файла
export const getFilePublicUrl = (key: string, config?: S3Config): string => {
  const s3Config = config || getS3Config();
  return `${s3Config.endpoint}/${s3Config.bucket}/${key}`;
};

// Функция для генерации ключа файла в S3
export const generateFileKey = (mimeType: string, fileName: string): string => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const extension = fileName.split('.').pop() || '';
  
  // Группируем по типу файла
  const typePrefix = mimeType.split('/')[0]; // image, video, application, etc.
  
  return `files/files/${typePrefix}/${timestamp}-${random}.${extension}`;
}; 