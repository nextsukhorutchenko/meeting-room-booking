import {NextRequest} from 'next/server';
import {describe, expect, it} from 'vitest';
import {
  authReturnToHeader,
  loginPathForReturnTo,
} from '../../src/lib/auth/return-routing';
import {config, proxy} from '../../src/proxy';

describe('authenticated return routing', () => {
  it.each([
    [
      'https://roomwork.test/schedule?roomId=oak&day=2026-08-04',
      '/schedule?roomId=oak&day=2026-08-04',
    ],
    [
      'https://roomwork.test/my-bookings?scope=future',
      '/my-bookings?scope=future',
    ],
  ])('forwards the protected destination for %s', (url, expected) => {
    const response = proxy(new NextRequest(url));

    expect(response.headers.get(
      `x-middleware-request-${authReturnToHeader}`,
    )).toBe(expected);
  });

  it.each([
    [
      'https://roomwork.test/schedule?roomId=oak&query=quiet%26sunny',
      '/schedule?roomId=oak&query=quiet%26sunny',
    ],
    [
      'https://roomwork.test/my-bookings?scope=future&label=100%25',
      '/my-bookings?scope=future&label=100%25',
    ],
  ])(
    'preserves the initial signed-out destination without a login loop for %s',
    (url, expected) => {
      const response = proxy(new NextRequest(url));
      const protectedDestination = response.headers.get(
        `x-middleware-request-${authReturnToHeader}`,
      );
      const loginPath = loginPathForReturnTo(protectedDestination);
      const loginUrl = new URL(loginPath, 'https://roomwork.test');
      const afterLogin = loginUrl.searchParams.get('returnTo');

      expect(loginUrl.pathname).toBe('/login');
      expect(afterLogin).toBe(expected);
      expect(loginPathForReturnTo(afterLogin)).toBe(loginPath);
      expect(afterLogin).not.toBe('/login');
    },
  );

  it('runs only for the two protected application routes', () => {
    expect(config.matcher).toEqual(['/schedule', '/my-bookings']);
  });
});
