import {z} from 'zod';

const titleError = 'Title must contain 1 to 100 Unicode characters';

export const bookingTitleSchema = z
  .string({error: titleError})
  .transform((value) => value.trim())
  .superRefine((value, context) => {
    const codePointLength = Array.from(value).length;
    if (codePointLength < 1 || codePointLength > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: titleError,
      });
    }
  });

export const createBookingSchema = z.strictObject({
  userId: z.string().trim().min(1, 'User is required'),
  roomId: z.string().trim().min(1, 'Room is required'),
  title: bookingTitleSchema,
  startsAt: z.instanceof(Date),
  endsAt: z.instanceof(Date),
});
