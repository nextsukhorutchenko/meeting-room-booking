import {DateTime} from 'luxon';
import type {NextRequest} from 'next/server';
import {z, type ZodError} from 'zod';
import {apiError, apiSuccess, readJsonBody} from '../../../lib/http/api-response';
import {DomainError, type DomainErrorFields} from '../../../lib/http/domain-error';
import {assertSameOrigin} from '../../../lib/http/same-origin';
import {requireUser} from '../../../modules/auth/auth.service';
import {bookingTitleSchema} from '../../../modules/bookings/booking.schemas';
import {createBooking} from '../../../modules/bookings/booking.service';

const dateTimeError = 'Enter an ISO date-time with an explicit offset';
const explicitOffsetDateTimePattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/;

const explicitOffsetDateTimeSchema = z
  .string({error: dateTimeError})
  .refine(
    (value) =>
      explicitOffsetDateTimePattern.test(value) &&
      DateTime.fromISO(value, {setZone: true}).isValid,
    dateTimeError,
  )
  .transform((value) => DateTime.fromISO(value, {setZone: true}).toUTC().toJSDate());

const createBookingRequestSchema = z.strictObject({
  roomId: z.string({error: 'Room is required'}).trim().min(1, 'Room is required'),
  title: bookingTitleSchema,
  startsAt: explicitOffsetDateTimeSchema,
  endsAt: explicitOffsetDateTimeSchema,
});

function validationError(error: ZodError): DomainError {
  const fields: DomainErrorFields = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fields[field]) {
      fields[field] = issue.message;
    }
  }

  if (Object.keys(fields).length === 0) {
    fields.body = 'Request body must be an object with valid booking fields';
  }

  return new DomainError({
    code: 'VALIDATION_FAILED',
    message: 'Please correct the highlighted fields',
    status: 400,
    fields,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request);
    const user = await requireUser(request.clone());
    const parsed = createBookingRequestSchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      throw validationError(parsed.error);
    }

    return apiSuccess(await createBooking({...parsed.data, userId: user.id}), 201);
  } catch (error) {
    return apiError(error);
  }
}
