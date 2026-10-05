import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: any };

const createPrismaClient = () => {
  const baseClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  return baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          try {
            return await query(args);
          } catch (error: any) {
            const msg = error?.message || '';
            const isConnReset =
              msg.includes('10054') ||
              msg.includes('ConnectionReset') ||
              msg.includes('forcibly closed') ||
              msg.includes('closed by the remote host') ||
              msg.includes('Connection reset by peer') ||
              msg.includes('Engine closed') ||
              error?.code === 'P1001' ||
              error?.code === 'P1017';

            if (isConnReset) {
              console.warn(`[Prisma] Stale connection detected (${operation} on ${model}). Reconnecting and retrying...`);
              return await query(args);
            }
            throw error;
          }
        },
      },
    },
  });
};

export const prisma: any = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

