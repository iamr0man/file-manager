import { z } from 'zod';

// Схема конфигурации Kafka
export const KafkaConfigSchema = z.object({
  brokers: z.array(z.string()).default(['localhost:9092']),
  clientId: z.string().default('file-manager'),
  groupId: z.string().default('file-manager-group'),
  retries: z.number().int().min(0).default(3),
  timeout: z.number().int().min(1000).default(30000),
});

export type KafkaConfig = z.infer<typeof KafkaConfigSchema>;

// Функция для получения конфигурации Kafka
export const getKafkaConfig = (): KafkaConfig => {
  return KafkaConfigSchema.parse({
    brokers: process.env.KAFKA_BROKERS 
      ? process.env.KAFKA_BROKERS.split(',') 
      : undefined,
    clientId: process.env.KAFKA_CLIENT_ID,
    groupId: process.env.KAFKA_GROUP_ID,
    retries: process.env.KAFKA_RETRIES 
      ? parseInt(process.env.KAFKA_RETRIES) 
      : undefined,
    timeout: process.env.KAFKA_TIMEOUT 
      ? parseInt(process.env.KAFKA_TIMEOUT) 
      : undefined,
  });
};

// Константы для топиков
export const KAFKA_TOPICS = {
  FILE_EVENTS: 'file-events',
} as const; 