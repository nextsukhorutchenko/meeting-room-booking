import {NextRequest} from 'next/server';

export type PostHandler = (request: NextRequest) => Promise<Response>;

type PostJsonOptions = {
  cookie?: string;
  origin?: string | null;
  rawBody?: string;
};

function appUrl(): URL {
  return new URL(process.env.APP_URL ?? 'http://127.0.0.1:3000');
}

export async function postJson(
  handler: PostHandler,
  path: string,
  body: unknown,
  options: PostJsonOptions = {},
): Promise<Response> {
  const url = new URL(path, appUrl());
  const headers = new Headers({'content-type': 'application/json'});
  if (options.origin !== null) {
    headers.set('origin', options.origin ?? appUrl().origin);
  }
  if (options.cookie) {
    headers.set('cookie', options.cookie);
  }

  return handler(new NextRequest(url, {
    method: 'POST',
    headers,
    body: options.rawBody ?? JSON.stringify(body),
  }));
}

export function readSessionCookie(response: Response): {
  header: string;
  token: string;
} {
  const setCookie = response.headers.get('set-cookie');
  if (!setCookie) {
    throw new Error('Expected a Set-Cookie response header');
  }

  const header = setCookie.split(';', 1)[0];
  const request = new NextRequest(appUrl(), {
    headers: {cookie: header},
  });
  const token = request.cookies.get('mrb_session')?.value;
  if (!token) {
    throw new Error('Expected an mrb_session cookie');
  }

  return {header, token};
}

export function requestWithCookie(cookie: string): NextRequest {
  return new NextRequest(new URL('/schedule', appUrl()), {
    headers: {cookie},
  });
}
