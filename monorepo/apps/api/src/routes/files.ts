import { FastifyInstance } from 'fastify';
import { singleUploadHandler, batchUploadHandler } from '../handlers/upload';

// Регистрация маршрутов для работы с файлами
export const registerFileRoutes = async (fastify: FastifyInstance) => {
  // Одиночная загрузка файла
  fastify.post('/api/files/upload', singleUploadHandler);

  // Мультизагрузка файлов
  fastify.post('/api/files/upload-batch', batchUploadHandler);

  console.log('📁 File routes registered:');
  console.log(`  POST /api/files/upload - Single file upload`);
  console.log(`  POST /api/files/upload-batch - Batch file upload`);
}; 