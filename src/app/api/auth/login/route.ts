import type {NextRequest} from 'next/server';
import {
  apiError,
  apiSuccess,
  setSessionCookie,
} from '../../../../lib/http/api-response';
import {assertSameOrigin} from '../../../../lib/http/same-origin';
import {readProtectedAuthBody} from '../../../../modules/auth/auth-request-protection';
import {login} from '../../../../modules/auth/auth.service';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request);
    const result = await login(await readProtectedAuthBody(request, 'login'));
    const response = apiSuccess({user: result.user});
    setSessionCookie(response, result.token, result.expiresAt);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
