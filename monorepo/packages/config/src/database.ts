import { z } from 'zod';

// Схема конфигурации базы данных
export const DatabaseConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().min(1).max(65535).default(5432),
  database: z.string().default('fileplatform'),
  username: z.string().default('admin'),
  password: z.string().default('password'),
  ssl: z.boolean().default(false),
  maxConnections: z.number().int().min(1).default(10),
});

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// Функция для получения конфигурации базы данных
export const getDatabaseConfig = (): DatabaseConfig => {
  return DatabaseConfigSchema.parse({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT) : undefined,
    database: process.env.DATABASE_NAME,
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === 'true',
    maxConnections: process.env.DATABASE_MAX_CONNECTIONS 
      ? parseInt(process.env.DATABASE_MAX_CONNECTIONS) 
      : undefined,
  });
};

// Функция для получения DATABASE_URL для Prisma
export const getDatabaseUrl = (config?: DatabaseConfig): string => {
  const dbConfig = config || getDatabaseConfig();
  return `postgresql://${dbConfig.username}:${dbConfig.password}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
}; 