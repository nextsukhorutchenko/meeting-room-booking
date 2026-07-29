'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
} from 'lucide-react';
import Link from 'next/link';
import {useEffect, useRef, useState} from 'react';
import {AuthShell} from '../../components/auth/auth-shell';

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
    if (!verificationRequest.current) {
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

      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${window.location.hash}`,
      );
      verificationRequest.current = requestVerification(token);
    }

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
      icon: <LoaderCircle aria-hidden="true" className="verification-icon-pending" />,
      heading: 'Підтверджуємо email',
      message: 'Перевіряємо посилання підтвердження.',
    },
    success: {
      icon: <CheckCircle2 aria-hidden="true" className="verification-icon-success" />,
      heading: 'Email підтверджено',
      message: 'Тепер ви можете бронювати переговорні.',
    },
    expired: {
      icon: <Clock3 aria-hidden="true" className="verification-icon-expired" />,
      heading: 'Посилання підтвердження прострочене',
      message: 'Посилання недійсне, прострочене або вже використане.',
    },
    error: {
      icon: <AlertTriangle aria-hidden="true" className="verification-icon-error" />,
      heading: 'Підтвердження недоступне',
      message:
        'Не вдалося підтвердити email. Спробуйте відкрити посилання ще раз.',
    },
    invalid: {
      icon: <AlertTriangle aria-hidden="true" className="verification-icon-error" />,
      heading: 'Посилання підтвердження недійсне',
      message: 'Відкрийте повне посилання підтвердження.',
    },
  }[state];

  return (
    <AuthShell heading={content.heading}>
      <div
        aria-atomic="true"
        aria-labelledby="auth-heading"
        aria-live="polite"
        className="verification-content"
        role="status"
      >
        <div className="verification-icon" aria-hidden="true">
          {content.icon}
        </div>
        <p className="verification-message">{content.message}</p>
        {state === 'success' ? (
          <Link className="auth-primary-link" href="/schedule">
            До розкладу
          </Link>
        ) : null}
        {state === 'expired' || state === 'error' || state === 'invalid' ? (
          <Link className="auth-primary-link" href="/schedule">
            До розкладу
          </Link>
        ) : null}
      </div>
    </AuthShell>
  );
}
