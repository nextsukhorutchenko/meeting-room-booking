import {NextResponse} from 'next/server';
import {prisma} from '../../../lib/db/prisma';

export type HealthDatabase = {
  queryRaw(): Promise<unknown>;
};

export async function getHealthResponse(
  database: HealthDatabase,
): Promise<Response> {
  try {
    await database.queryRaw();
    return NextResponse.json({data: {status: 'ok'}});
  } catch {
    return NextResponse.json({
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable',
      },
    }, {status: 503});
  }
}

export async function GET(): Promise<Response> {
  return getHealthResponse({
    queryRaw: async () => prisma.$queryRaw`SELECT 1`,
  });
}
