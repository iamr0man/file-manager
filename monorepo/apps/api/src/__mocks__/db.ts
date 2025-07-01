import { jest } from '@jest/globals';
import type { File } from '@file-manager/types';

export const prisma = {
  file: {
    findMany: jest.fn<() => Promise<File[]>>(),
    create: jest.fn<(args: { data: Partial<File> }) => Promise<File>>(),
    delete: jest.fn<(args: { where: { id: string } }) => Promise<File>>(),
  },
}; 