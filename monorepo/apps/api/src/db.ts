import { PrismaClient } from '@prisma/client';

// Create global variable for Prisma client in dev mode
// to avoid recreating connections on hot reload
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Create Prisma client with logging in dev mode
export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// In dev mode, save client in global variable
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Graceful shutdown - close connection on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
}); 