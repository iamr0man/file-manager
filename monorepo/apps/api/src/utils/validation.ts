import * as path from 'path';
import { z } from 'zod';

// Validation constants
export const VALIDATION_LIMITS = {
  MAX_FILE_SIZE: 1024 * 1024 * 1024, // 1GB
  MAX_FILES_BATCH: 50, // Increased from 10 to 50
  MIN_FILENAME_LENGTH: 1,
  MAX_FILENAME_LENGTH: 255,
} as const;

// List of allowed MIME types (extensible)
export const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
  'image/svg+xml',
  
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  
  // Text
  'text/plain',
  'text/csv',
  'application/json',
  'text/html',
  
  // Archives
  'application/zip',
  'application/x-rar-compressed',
  'application/x-7z-compressed',
  
  // Video
  'video/mp4',
  'video/mpeg',
  'video/quicktime',
  
  // Audio
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',

  // Mac specific
  'application/x-apple-diskimage',
] as const;

// File validation schema
export const FileValidationSchema = z.object({
  filename: z.string()
    .min(VALIDATION_LIMITS.MIN_FILENAME_LENGTH)
    .max(VALIDATION_LIMITS.MAX_FILENAME_LENGTH),
  mimetype: z.string().min(1),
  size: z.number().int().min(1).max(VALIDATION_LIMITS.MAX_FILE_SIZE),
  buffer: z.instanceof(Buffer),
});

export type ValidatedFile = z.infer<typeof FileValidationSchema>;

// Validation result
export interface ValidationResult {
  success: boolean;
  error?: string;
  code?: string;
}

// Single file validation
export const validateFile = (fileData: {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}): ValidationResult => {
  try {
    // Main validation through Zod
    FileValidationSchema.parse(fileData);
    
    // Check MIME type
    if (!ALLOWED_MIME_TYPES.includes(fileData.mimetype as any)) {
      return {
        success: false,
        error: `Unsupported file type: ${fileData.mimetype}`,
        code: 'UNSUPPORTED_FILE_TYPE',
      };
    }
    
    // Check file extension
    const ext = path.extname(fileData.filename).toLowerCase();
    if (!isExtensionValid(ext, fileData.mimetype)) {
      return {
        success: false,
        error: `File extension ${ext} doesn't match MIME type ${fileData.mimetype}`,
        code: 'EXTENSION_MISMATCH',
      };
    }
    
    // Check file content (simple header check)
    if (!isFileContentValid(fileData.buffer, fileData.mimetype)) {
      return {
        success: false,
        error: 'File content doesn\'t match declared type',
        code: 'CONTENT_MISMATCH',
      };
    }
    
    return { success: true };
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        error: error.errors.map(e => e.message).join(', '),
        code: 'VALIDATION_ERROR',
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error',
      code: 'UNKNOWN_ERROR',
    };
  }
};

// File array validation
export const validateFiles = (files: Array<{
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}>): ValidationResult => {
  // Check number of files
  if (files.length > VALIDATION_LIMITS.MAX_FILES_BATCH) {
    return {
      success: false,
      error: `Too many files. Maximum ${VALIDATION_LIMITS.MAX_FILES_BATCH} allowed`,
      code: 'TOO_MANY_FILES',
    };
  }
  
  if (files.length === 0) {
    return {
      success: false,
      error: 'No files provided',
      code: 'NO_FILES',
    };
  }
  
  // Validate each file
  for (let i = 0; i < files.length; i++) {
    const result = validateFile(files[i]);
    if (!result.success) {
      return {
        success: false,
        error: `File ${i + 1} (${files[i].filename}): ${result.error}`,
        code: result.code,
      };
    }
  }
  
  return { success: true };
};

// Filename sanitization
export const sanitizeFilename = (filename: string): string => {
  // Remove dangerous characters
  const sanitized = filename
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_') // Replace dangerous characters
    .replace(/\.\./g, '_') // Remove directory traversal attempts
    .replace(/^\.+/, '') // Remove dots at the beginning
    .trim();
    
  // Ensure minimum length
  if (sanitized.length === 0) {
    return 'unnamed_file';
  }
  
  return sanitized;
};

// Check extension matches MIME type
const isExtensionValid = (extension: string, mimetype: string): boolean => {
  const mimeToExtensions: Record<string, string[]> = {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/png': ['.png'],
    'image/gif': ['.gif'],
    'image/webp': ['.webp'],
    'application/pdf': ['.pdf'],
    'text/plain': ['.txt'],
    'text/html': ['.html', '.htm'],
    'application/json': ['.json'],
    'application/zip': ['.zip'],
    'video/mp4': ['.mp4'],
    'audio/mpeg': ['.mp3'],
    'application/x-apple-diskimage': ['.dmg'],
    // Add as needed
  };
  
  const allowedExtensions = mimeToExtensions[mimetype];
  if (!allowedExtensions) {
    // If MIME type is not in our list, skip extension check
    return true;
  }
  
  return allowedExtensions.includes(extension.toLowerCase());
};

// Basic file content check by headers
const isFileContentValid = (buffer: Buffer, mimetype: string): boolean => {
  if (buffer.length < 4) return false;
  
  const header = buffer.subarray(0, 4);
  
  // Check some common formats
  switch (mimetype) {
    case 'image/jpeg':
      return header[0] === 0xFF && header[1] === 0xD8;
    case 'image/png':
      return header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47;
    case 'image/gif':
      return buffer.subarray(0, 6).toString() === 'GIF87a' || buffer.subarray(0, 6).toString() === 'GIF89a';
    case 'application/pdf':
      return buffer.subarray(0, 4).toString() === '%PDF';
    case 'application/zip':
      return header[0] === 0x50 && header[1] === 0x4B;
    default:
      // Skip check for other types
      return true;
  }
};

// Format file size for user
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}; 