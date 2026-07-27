import type {NextRequest} from 'next/server';
import {
  apiError,
  apiSuccess,
  readJsonBody,
  setSessionCookie,
} from '../../../../lib/http/api-response';
import {assertSameOrigin} from '../../../../lib/http/same-origin';
import {register} from '../../../../modules/auth/auth.service';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request);
    const result = await register(await readJsonBody(request));
    const response = apiSuccess({user: result.user}, 201);
    setSessionCookie(response, result.token, result.expiresAt);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
