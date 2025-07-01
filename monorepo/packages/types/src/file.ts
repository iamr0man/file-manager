import { z } from 'zod';

// Zod schemas for validation
export const FileSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  url: z.string().url(),
  size: z.number().int().min(1).max(200 * 1024 * 1024), // 200MB limit
  mimeType: z.string().min(1),
  uploadedBy: z.string().min(1), // currently string, later can be linked to User
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  previewUrl: z.string().url().nullable(),
});

export const FileCreateSchema = z.object({
  name: z.string().min(1).max(255),
  originalName: z.string().min(1).max(255),
  size: z.number().int().min(1).max(200 * 1024 * 1024),
  mimeType: z.string().min(1),
  uploadedBy: z.string().min(1),
});

export const FileUpdateSchema = FileCreateSchema.partial();

// TypeScript types from Zod schemas
export type File = z.infer<typeof FileSchema>;
export type FileCreate = z.infer<typeof FileCreateSchema>;
export type FileUpdate = z.infer<typeof FileUpdateSchema>;

// Additional types for UI
export type FileListItem = Pick<File, 'id' | 'name' | 'size' | 'mimeType' | 'createdAt' | 'url'>; 