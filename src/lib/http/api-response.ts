import {NextResponse} from 'next/server';
import {DomainError} from './domain-error';

export const sessionCookieName = 'mrb_session';

export async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new DomainError({
      code: 'VALIDATION_FAILED',
      message: 'Request body must be valid JSON',
      status: 400,
    });
  }
}

export function apiSuccess<T>(
  data: T,
  status = 200,
): NextResponse<{data: T}> {
  return NextResponse.json({data}, {status});
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof DomainError) {
    return NextResponse.json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? {fields: error.fields} : {}),
      },
    }, {status: error.status});
  }

  return NextResponse.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    },
  }, {status: 500});
}

function sessionCookieOptions(expires: Date): {
  expires: Date;
  httpOnly: true;
  path: '/';
  sameSite: 'lax';
  secure: boolean;
} {
  return {
    expires,
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  };
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  expiresAt: Date,
): void {
  response.cookies.set(
    sessionCookieName,
    token,
    sessionCookieOptions(expiresAt),
  );
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(
    sessionCookieName,
    '',
    sessionCookieOptions(new Date(0)),
  );
}
