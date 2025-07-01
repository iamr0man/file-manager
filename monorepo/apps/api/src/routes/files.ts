import { FastifyInstance } from 'fastify';
import { singleUploadHandler, batchUploadHandler } from '../handlers/upload';

// Register routes for file operations
export const registerFileRoutes = async (fastify: FastifyInstance) => {
  // Single file upload
  fastify.post('/api/files/upload', singleUploadHandler);

  // Batch file upload
  fastify.post('/api/files/upload-batch', batchUploadHandler);

  console.log('📁 File routes registered:');
  console.log(`  POST /api/files/upload - Single file upload`);
  console.log(`  POST /api/files/upload-batch - Batch file upload`);
}; 