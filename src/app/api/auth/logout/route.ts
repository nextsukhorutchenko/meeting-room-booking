import type {NextRequest} from 'next/server';
import {
  apiError,
  apiSuccess,
  clearSessionCookie,
  sessionCookieName,
} from '../../../../lib/http/api-response';
import {assertSameOrigin} from '../../../../lib/http/same-origin';
import {logout} from '../../../../modules/auth/auth.service';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertSameOrigin(request);
    await logout(request.cookies.get(sessionCookieName)?.value);
    const response = apiSuccess({loggedOut: true});
    clearSessionCookie(response);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
