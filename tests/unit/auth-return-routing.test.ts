import {NextRequest} from 'next/server';
import {describe, expect, it} from 'vitest';
import {authReturnToHeader} from '../../src/lib/auth/return-routing';
import {config, proxy} from '../../proxy';

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

  it('runs only for the two protected application routes', () => {
    expect(config.matcher).toEqual(['/schedule', '/my-bookings']);
  });
});
