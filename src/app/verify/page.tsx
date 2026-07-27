'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
} from 'lucide-react';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';

type VerificationState =
  | 'pending'
  | 'success'
  | 'expired'
  | 'error'
  | 'invalid';

type ErrorResponse = {
  error?: {
    code?: string;
  };
};

const scheduleLinkClassName = [
  'inline-flex min-h-11 items-center justify-center rounded-md',
  'bg-emerald-700 px-4 py-2 text-sm font-semibold text-white',
  'hover:bg-emerald-800 focus-visible:outline-2',
  'focus-visible:outline-offset-2 focus-visible:outline-emerald-700',
].join(' ');

async function requestVerification(token: string): Promise<VerificationState> {
  try {
    const response = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({token}),
    });
    const body = await response.json() as ErrorResponse;
    if (response.ok) {
      return 'success';
    }
    if (body.error?.code === 'VERIFICATION_INVALID_OR_EXPIRED') {
      return 'expired';
    }
    return 'error';
  } catch {
    return 'error';
  }
}

export default function VerifyPage() {
  const [state, setState] = useState<VerificationState>('pending');
  const verificationRequest = useRef<Promise<VerificationState> | null>(null);

  useEffect(() => {
    let active = true;
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) {
      queueMicrotask(() => {
        if (active) {
          setState('invalid');
        }
      });
      return () => {
        active = false;
      };
    }

    verificationRequest.current ??= requestVerification(token);
    void verificationRequest.current.then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const content = {
    pending: {
      icon: <LoaderCircle aria-hidden="true" className="animate-spin" />,
      heading: 'Verifying your email',
      message: 'Checking your development verification link.',
    },
    success: {
      icon: <CheckCircle2 aria-hidden="true" className="text-emerald-700" />,
      heading: 'Email verified',
      message: 'Your account can now create room bookings.',
    },
    expired: {
      icon: <Clock3 aria-hidden="true" className="text-amber-700" />,
      heading: 'Verification link expired',
      message: 'This link is invalid, expired, or has already been used.',
    },
    error: {
      icon: <AlertTriangle aria-hidden="true" className="text-red-700" />,
      heading: 'Verification unavailable',
      message:
        'We could not verify your email. Try the development link again.',
    },
    invalid: {
      icon: <AlertTriangle aria-hidden="true" className="text-red-700" />,
      heading: 'Verification link invalid',
      message: 'Open the complete development link from the server console.',
    },
  }[state];

  return (
    <main className="auth-shell">
      <section
        aria-labelledby="verification-heading"
        className="auth-panel text-center"
      >
        <div className="grid justify-items-center gap-3">
          <div className="size-8" aria-hidden="true">
            {content.icon}
          </div>
          <div className="grid gap-2">
            <p className="text-sm font-semibold text-emerald-700">
              Meeting Room Booking
            </p>
            <h1
              className="text-2xl font-semibold text-slate-950"
              id="verification-heading"
            >
              {content.heading}
            </h1>
            <p className="text-sm leading-6 text-slate-600">
              {content.message}
            </p>
          </div>
        </div>
        {state === 'success' ? (
          <Link className={scheduleLinkClassName} href="/schedule">
            Go to schedule
          </Link>
        ) : null}
        {state === 'expired' || state === 'error' || state === 'invalid' ? (
          <Link className={scheduleLinkClassName} href="/schedule">
            Back to schedule
          </Link>
        ) : null}
      </section>
    </main>
  );
}
