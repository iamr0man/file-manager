import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { fileRouter } from './trpc/router';
import { s3Service } from './services/s3';
import { initKafkaProducer } from './services/kafka';
import { getDatabaseConfig } from '@file-manager/config';
import { registerFileRoutes } from './routes/files';

// Создаем Fastify сервер
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

// Регистрируем плагин для загрузки файлов
fastify.register(multipart, {
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
    files: 10, // максимум 10 файлов за раз
  },
});

// Регистрируем tRPC плагин
fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: fileRouter,
    createContext: () => ({}),
  },
});

// Регистрируем маршруты для файлов
fastify.register(registerFileRoutes);

// Инициализируем Kafka producer
initKafkaProducer().catch((error) => {
  console.error('Failed to initialize Kafka producer:', error);
});

// Запускаем сервер
const start = async () => {
  try {
    const { host, port } = getDatabaseConfig();
    await fastify.listen({ port: 3001, host });
    console.log(`Server is running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start(); 