import { PrismaClient } from '@prisma/client';

// Создаем глобальную переменную для Prisma клиента в dev режиме
// чтобы избежать пересоздания подключений при hot reload
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

// Создаем Prisma клиент с логированием в dev режиме
export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// В dev режиме сохраняем клиент в глобальной переменной
if (process.env.NODE_ENV !== 'production') {
  globalThis.__prisma = prisma;
}

// Graceful shutdown - закрываем подключение при завершении процесса
process.on('beforeExit', async () => {
  await prisma.$disconnect();
}); 