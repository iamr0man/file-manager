import { Kafka, Producer } from 'kafkajs';
import { getKafkaConfig } from '@file-manager/config';
import { FileUploadedEvent, FileDeletedEvent, KAFKA_TOPICS, FILE_EVENTS } from '@file-manager/types';

// Create Kafka client
const kafkaConfig = getKafkaConfig();
const kafka = new Kafka({
  clientId: kafkaConfig.clientId,
  brokers: kafkaConfig.brokers,
  retry: {
    retries: kafkaConfig.retries,
  },
});

let producer: Producer | null = null;

// Initialize Kafka producer
export const initKafkaProducer = async (): Promise<void> => {
  try {
    producer = kafka.producer();
    await producer.connect();
    console.log('✅ Kafka producer connected');
  } catch (error) {
    console.error('❌ Failed to connect Kafka producer:', error);
    throw error;
  }
};

// Close Kafka producer
export const closeKafkaProducer = async (): Promise<void> => {
  if (producer) {
    try {
      await producer.disconnect();
      console.log('✅ Kafka producer disconnected');
    } catch (error) {
      console.error('❌ Failed to disconnect Kafka producer:', error);
    }
  }
};

// Publish file upload event
export const publishFileUploadedEvent = async (eventData: Omit<FileUploadedEvent['data'], 'fileId'> & { fileId: string }): Promise<void> => {
  if (!producer) {
    console.warn('⚠️ Kafka producer not initialized, skipping event publication');
    return;
  }

  const event: FileUploadedEvent = {
    id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    source: 'file-manager-api',
    version: '1.0',
    type: FILE_EVENTS.UPLOADED,
    data: eventData,
  };

  try {
    await producer.send({
      topic: KAFKA_TOPICS.FILE_EVENTS,
      messages: [
        {
          key: eventData.fileId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.getTime().toString(),
        },
      ],
    });

    console.log(`✅ File uploaded event published: ${eventData.fileId}`);
  } catch (error) {
    console.error('❌ Failed to publish file uploaded event:', error);
    // Don't throw error to avoid disrupting main file upload flow
  }
};

// Publish file delete event
export const publishFileDeletedEvent = async (eventData: FileDeletedEvent['data']): Promise<void> => {
  if (!producer) {
    console.warn('⚠️ Kafka producer not initialized, skipping event publication');
    return;
  }

  const event: FileDeletedEvent = {
    id: `delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    source: 'file-manager-api',
    version: '1.0',
    type: FILE_EVENTS.DELETED,
    data: eventData,
  };

  try {
    await producer.send({
      topic: KAFKA_TOPICS.FILE_EVENTS,
      messages: [
        {
          key: eventData.fileId,
          value: JSON.stringify(event),
          timestamp: event.timestamp.getTime().toString(),
        },
      ],
    });

    console.log(`✅ File deleted event published: ${eventData.fileId}`);
  } catch (error) {
    console.error('❌ Failed to publish file deleted event:', error);
    // Don't throw error to avoid disrupting main file delete flow
  }
};

// Graceful shutdown
process.on('beforeExit', async () => {
  await closeKafkaProducer();
}); 