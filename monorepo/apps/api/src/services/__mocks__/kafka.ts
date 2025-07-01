import type { FileUploadedEvent, FileDeletedEvent } from '@file-manager/types';

export const mockEvents: (FileUploadedEvent | FileDeletedEvent)[] = [];

type FileUploadedEventData = Omit<FileUploadedEvent['data'], 'fileId'> & { fileId: string };
type FileDeletedEventData = FileDeletedEvent['data'];

export const initKafkaProducer = jest.fn().mockResolvedValue(undefined);

export const closeKafkaProducer = jest.fn().mockResolvedValue(undefined);

export const publishFileUploadedEvent = jest.fn().mockImplementation(async (eventData: FileUploadedEventData) => {
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

export const publishFileDeletedEvent = jest.fn().mockImplementation(async (eventData: FileDeletedEventData) => {
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