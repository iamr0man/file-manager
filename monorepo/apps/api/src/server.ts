import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { fileRouter } from './trpc/router';
import { s3Service } from './services/s3';
import { initKafkaProducer } from './services/kafka';
import { getDatabaseConfig } from '@file-manager/config';
import { registerFileRoutes } from './routes/files';

// Create Fastify server
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'info' : 'warn',
  },
});

// Register CORS plugin
fastify.register(cors, {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
});

// Register plugin for file uploads
fastify.register(multipart, {
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB
    files: 10, // maximum 10 files at once
  },
});

// Register tRPC plugin
fastify.register(fastifyTRPCPlugin, {
  prefix: '/trpc',
  trpcOptions: {
    router: fileRouter,
    createContext: () => ({}),
  },
});

// Register file routes
fastify.register(registerFileRoutes);

// Initialize Kafka producer
initKafkaProducer().catch((error) => {
  console.error('Failed to initialize Kafka producer:', error);
});

// Start server
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