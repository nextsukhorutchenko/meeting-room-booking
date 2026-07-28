import {NextResponse} from 'next/server';
import {DomainError} from './domain-error';

export const sessionCookieName = 'mrb_session';

function payloadTooLargeError(): DomainError {
  return new DomainError({
    code: 'PAYLOAD_TOO_LARGE',
    message: 'Request body is too large',
    status: 413,
  });
}

export async function readJsonBody(
  request: Request,
  maxBytes = 1024 * 1024,
): Promise<unknown> {
  const declaredLength = request.headers.get('content-length');
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > maxBytes
  ) {
    throw payloadTooLargeError();
  }

  try {
    if (!request.body) {
      throw new Error('Request body is empty');
    }
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let byteLength = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) {
        break;
      }
      byteLength += value.byteLength;
      if (byteLength > maxBytes) {
        await reader.cancel();
        throw payloadTooLargeError();
      }
      chunks.push(value);
    }
    const content = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      content.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(content));
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
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
    const response = NextResponse.json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? {fields: error.fields} : {}),
      },
    }, {status: error.status});
    if (error.retryAfterSeconds !== undefined) {
      response.headers.set('retry-after', String(error.retryAfterSeconds));
    }
    return response;
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
