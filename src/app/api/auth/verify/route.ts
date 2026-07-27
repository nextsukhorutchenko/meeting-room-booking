import type {NextRequest} from 'next/server';
import {z} from 'zod';
import {
  apiError,
  apiSuccess,
  readJsonBody,
} from '../../../../lib/http/api-response';
import {DomainError} from '../../../../lib/http/domain-error';
import {assertSameOrigin} from '../../../../lib/http/same-origin';
import {verifyEmailToken} from '../../../../modules/auth/verification.service';

const verifyRequestSchema = z.strictObject({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request);
    const parsed = verifyRequestSchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      throw new DomainError({
        code: 'VALIDATION_FAILED',
        message: 'Invalid verification request',
        status: 400,
      });
    }

    await verifyEmailToken(parsed.data.token);
    return apiSuccess({verified: true});
  } catch (error) {
    return apiError(error);
  }
}
