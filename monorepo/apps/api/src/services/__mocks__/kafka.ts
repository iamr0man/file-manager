import { jest } from '@jest/globals';
import type { FileUploadedEvent, FileDeletedEvent } from '@file-manager/types';

export const mockEvents: (FileUploadedEvent | FileDeletedEvent)[] = [];

type FileUploadedEventData = Omit<FileUploadedEvent['data'], 'fileId'> & { fileId: string };
type FileDeletedEventData = FileDeletedEvent['data'];

export const initKafkaProducer = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

export const closeKafkaProducer = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);

export const publishFileUploadedEvent = jest.fn<(eventData: FileUploadedEventData) => Promise<void>>().mockImplementation(async (eventData) => {
  const event: FileUploadedEvent = {
    id: `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    source: 'file-manager-api',
    version: '1.0',
    type: 'file.uploaded',
    data: eventData,
  };
  mockEvents.push(event);
});

export const publishFileDeletedEvent = jest.fn<(eventData: FileDeletedEventData) => Promise<void>>().mockImplementation(async (eventData) => {
  const event: FileDeletedEvent = {
    id: `delete_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    source: 'file-manager-api',
    version: '1.0',
    type: 'file.deleted',
    data: eventData,
  };
  mockEvents.push(event);
});

export const clearMockEvents = () => {
  mockEvents.length = 0;
  publishFileUploadedEvent.mockClear();
  publishFileDeletedEvent.mockClear();
}; 