'use client';

import {useRouter} from 'next/navigation';
import {useEffect, useRef, type ReactNode} from 'react';
import {loginPathForReturnTo} from '../../lib/auth/return-routing';

const authRequiredEvent = 'roomwork:auth-required';

export function announceAuthRequired(code: string | undefined): boolean {
  if (code !== 'AUTH_REQUIRED') return false;
  window.dispatchEvent(new Event(authRequiredEvent));
  return true;
}

export function AuthRequiredBoundary({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: string;
}) {
  const router = useRouter();
  const redirecting = useRef(false);

  useEffect(() => {
    function redirectToLogin(): void {
      if (redirecting.current) return;
      redirecting.current = true;
      router.replace(loginPathForReturnTo(`${pathname}${window.location.search}`));
    }

    window.addEventListener(authRequiredEvent, redirectToLogin);
    return () => window.removeEventListener(authRequiredEvent, redirectToLogin);
  }, [pathname, router]);

  return children;
}
