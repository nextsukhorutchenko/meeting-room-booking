import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '@prisma/client';
import {readAppEnv} from '@/lib/config/env';

const globalForPrisma = globalThis as unknown as {prisma?: PrismaClient};

function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({connectionString: databaseUrl}),
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient(readAppEnv().databaseUrl);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
