import '@testing-library/jest-dom';
import { jest } from '@jest/globals';

// Mock the logger to prevent console output during tests
const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
} as const;

jest.mock('./src/utils/logger', () => ({
  logger: mockLogger,
})); 