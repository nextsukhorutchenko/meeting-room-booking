import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {apiError, apiSuccess} from '../../../../lib/http/api-response';
import {DomainError} from '../../../../lib/http/domain-error';
import {requireUser} from '../../../../modules/auth/auth.service';
import {listUserBookings} from '../../../../modules/bookings/booking.service';

const positiveIntegerText = /^[1-9]\d*$/;

const bookingHistoryQuerySchema = z.strictObject({
  scope: z.enum(['future', 'past']),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z
    .string()
    .regex(positiveIntegerText)
    .transform((value) => Math.min(Number(value), 50))
    .default(20),
});

function invalidQueryError(): DomainError {
  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'Invalid booking history query.',
    status: 400,
  });
}

function queryValues(request: NextRequest): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const key of new Set(request.nextUrl.searchParams.keys())) {
    const entries = request.nextUrl.searchParams.getAll(key);
    values[key] = entries.length === 1 ? entries[0] : entries;
  }
  return values;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await requireUser(request);
    const parsed = bookingHistoryQuerySchema.safeParse(queryValues(request));
    if (!parsed.success) {
      throw invalidQueryError();
    }

    return apiSuccess(await listUserBookings({
      userId: user.id,
      scope: parsed.data.scope,
      ...(parsed.data.cursor ? {cursor: parsed.data.cursor} : {}),
      limit: parsed.data.limit,
      now: new Date(),
    }));
  } catch (error) {
    return apiError(error);
  }
}
