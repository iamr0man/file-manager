import { z } from 'zod';

// Базовый тип события
export const BaseEventSchema = z.object({
  id: z.string().cuid(),
  timestamp: z.date(),
  source: z.string(), // 'file-manager-api'
  version: z.string().default('1.0'),
});

// События файлов
export const FileUploadedEventSchema = BaseEventSchema.extend({
  type: z.literal('file.uploaded'),
  data: z.object({
    fileId: z.string(),
    fileName: z.string(),
    fileSize: z.number(),
    mimeType: z.string(),
    uploadedBy: z.string(),
    url: z.string(),
  }),
});

export const FileDeletedEventSchema = BaseEventSchema.extend({
  type: z.literal('file.deleted'),
  data: z.object({
    fileId: z.string(),
    fileName: z.string(),
    deletedBy: z.string(),
  }),
});

// Union тип для всех событий
export const FileEventSchema = z.union([
  FileUploadedEventSchema,
  FileDeletedEventSchema,
]);

// TypeScript типы
export type BaseEvent = z.infer<typeof BaseEventSchema>;
export type FileUploadedEvent = z.infer<typeof FileUploadedEventSchema>;
export type FileDeletedEvent = z.infer<typeof FileDeletedEventSchema>;
export type FileEvent = z.infer<typeof FileEventSchema>;

// Константы для типов событий
export const FILE_EVENTS = {
  UPLOADED: 'file.uploaded' as const,
  DELETED: 'file.deleted' as const,
} as const;

// Константы для Kafka топиков
export const KAFKA_TOPICS = {
  FILE_EVENTS: 'file-events',
} as const; 