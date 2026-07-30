import {NextResponse, type NextRequest} from 'next/server';
import {authReturnToHeader} from './src/lib/auth/return-routing';
import {safeReturnTo} from './src/lib/i18n/ui-errors';

export function proxy(request: NextRequest): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(
    authReturnToHeader,
    safeReturnTo(`${request.nextUrl.pathname}${request.nextUrl.search}`),
  );
  return NextResponse.next({request: {headers: requestHeaders}});
}

export const config = {
  matcher: ['/schedule', '/my-bookings'],
};
