import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, CreateBucketCommand, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { File as FileType } from '@file-manager/types';
import { getS3Config } from '@file-manager/config';

const s3Config = getS3Config();

export const DEFAULT_CONFIG = {
  endpoint: s3Config.endpoint,
  region: s3Config.region,
  credentials: {
    accessKeyId: s3Config.accessKeyId,
    secretAccessKey: s3Config.secretAccessKey,
  },
  bucket: s3Config.bucket,
  forcePathStyle: s3Config.forcePathStyle,
};

// Helper function to extract key from S3 URL
export const extractKeyFromUrl = (url: string): string => {
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/');
  // Remove empty parts and bucket name, but keep the 'files' folder structure
  const key = pathParts.filter(part => part.length > 0).slice(1).join('/');
  return key;
};

// Helper function to get preview URL for supported file types
export const getPreviewUrl = async (key: string, mimeType: string): Promise<string | null> => {
  // Check if file type is supported for preview
  const SUPPORTED_PREVIEW_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/pdf',
  ];

  if (!SUPPORTED_PREVIEW_TYPES.includes(mimeType)) {
    return null;
  }

  // For images and PDFs, we can use a signed URL with a longer expiration
  const PREVIEW_EXPIRY = 3600; // 1 hour
  try {
    const s3Client = new S3Client({
      endpoint: DEFAULT_CONFIG.endpoint,
      region: DEFAULT_CONFIG.region,
      credentials: DEFAULT_CONFIG.credentials,
      forcePathStyle: DEFAULT_CONFIG.forcePathStyle,
    });

    const command = new GetObjectCommand({
      Bucket: DEFAULT_CONFIG.bucket,
      Key: key,
    });

    return getSignedUrl(s3Client, command, { expiresIn: PREVIEW_EXPIRY });
  } catch (error) {
    console.error('Failed to generate preview URL:', error);
    return null;
  }
};

class S3Service {
  private client: S3Client;
  private readonly bucket: string;
  private readonly PREVIEW_EXPIRY = 3600; // 1 hour
  private readonly DOWNLOAD_EXPIRY = 60; // 1 minute
  private readonly SUPPORTED_PREVIEW_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/pdf',
  ];

  constructor() {
    this.client = new S3Client({
      endpoint: DEFAULT_CONFIG.endpoint,
      region: DEFAULT_CONFIG.region,
      credentials: DEFAULT_CONFIG.credentials,
      forcePathStyle: DEFAULT_CONFIG.forcePathStyle,
    });
    this.bucket = DEFAULT_CONFIG.bucket;
  }

  async ensureBucketExists(): Promise<void> {
    try {
      // Check if bucket exists
      await this.client.send(new HeadBucketCommand({
        Bucket: this.bucket,
      }));
      console.log(`✅ S3 bucket '${this.bucket}' exists`);
    } catch (error) {
      // If bucket doesn't exist, create it
      try {
        await this.client.send(new CreateBucketCommand({
          Bucket: this.bucket,
        }));
        console.log(`✅ Created S3 bucket '${this.bucket}'`);
      } catch (createError) {
        console.error(`❌ Failed to create S3 bucket '${this.bucket}':`, createError);
        throw createError;
      }
    }
  }

  async uploadFile(file: Buffer, mimeType: string, fileName: string): Promise<{ key: string }> {
    // Group files by type and include the 'files' folder in the path
    const typePrefix = mimeType.split('/')[0]; // image, video, application, etc.
    const timestamp = Date.now();
    const key = `files/${typePrefix}/${timestamp}-${fileName}`;

    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file,
      ContentType: mimeType,
    }));

    return { key };
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    }));
  }

  async getSignedUrl(key: string, expiresIn: number = this.DOWNLOAD_EXPIRY): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }

  async listFiles(): Promise<FileType[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: 'files/', // Only list objects in the 'files' folder
    });

    const response = await this.client.send(command);
    const files = (response.Contents || [])
      .filter(file => file.Key && !file.Key.endsWith('/')) // Filter out folder objects
      .map(file => {
        const fileName = file.Key!.split('/').pop()!; // Get just the filename
        const actualName = fileName.substring(fileName.indexOf('-') + 1);
        
        return {
          id: file.Key!,
          name: actualName,
          size: file.Size!,
          createdAt: file.LastModified!,
          originalName: actualName,
          url: `${DEFAULT_CONFIG.endpoint}/${this.bucket}/${file.Key}`,
          mimeType: this.getMimeType(fileName),
          uploadedBy: 'system', // We'll implement proper user management later
          previewUrl: this.isPreviewSupported(fileName) ? null : null, // We'll generate preview URLs on demand
        };
      });
    console.log({files});
    return files;
  }

  private getMimeType(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'gif':
        return 'image/gif';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'txt':
        return 'text/plain';
      case 'csv':
        return 'text/csv';
      default:
        return 'application/octet-stream';
    }
  }

  private isPreviewSupported(fileName: string): boolean {
    return this.SUPPORTED_PREVIEW_TYPES.includes(this.getMimeType(fileName));
  }
}

export const s3Service = new S3Service(); 