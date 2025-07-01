import { z } from 'zod';
import { FileSchema, FileCreateSchema } from './file';

// Стандартные API ответы
export const ApiSuccessSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  message: z.string().optional(),
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
});

export const ApiResponseSchema = z.union([ApiSuccessSchema, ApiErrorSchema]);

// Типы для API
export type ApiSuccess<T = any> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: string;
  code?: string;
};

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

// Типы для файловых операций
export const FileUploadRequestSchema = FileCreateSchema.extend({
  file: z.any(), // Blob/File object в браузере
});

export const FileUploadResponseSchema = ApiSuccessSchema.extend({
  data: FileSchema,
});

export const FileListResponseSchema = ApiSuccessSchema.extend({
  data: z.array(FileSchema),
});

export const FileDeleteResponseSchema = ApiSuccessSchema.extend({
  data: z.object({
    id: z.string(),
    deleted: z.boolean(),
  }),
});

// TypeScript типы
export type FileUploadRequest = z.infer<typeof FileUploadRequestSchema>;
export type FileUploadResponse = z.infer<typeof FileUploadResponseSchema>;
export type FileListResponse = z.infer<typeof FileListResponseSchema>;
export type FileDeleteResponse = z.infer<typeof FileDeleteResponseSchema>; 