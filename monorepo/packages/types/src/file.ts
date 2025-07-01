import { z } from 'zod';

// Zod схемы для валидации
export const FileSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().int().min(1).max(200 * 1024 * 1024), // 200MB limit
  mimeType: z.string().min(1),
  uploadedBy: z.string().min(1), // пока строка, позже можно связать с User
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const FileCreateSchema = z.object({
  name: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  size: z.number().int().min(1).max(200 * 1024 * 1024),
  mimeType: z.string().min(1),
  uploadedBy: z.string().min(1),
});

export const FileUpdateSchema = FileCreateSchema.partial();

// TypeScript типы из Zod схем
export type File = z.infer<typeof FileSchema>;
export type FileCreate = z.infer<typeof FileCreateSchema>;
export type FileUpdate = z.infer<typeof FileUpdateSchema>;

// Дополнительные типы для UI
export type FileListItem = Pick<File, 'id' | 'name' | 'size' | 'mimeType' | 'createdAt'>;

export type FileUploadProgress = {
  fileId: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}; 