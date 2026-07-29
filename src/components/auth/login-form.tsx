'use client';

import {useState, type FormEvent} from 'react';
import {Alert} from '../ui/alert';
import {Button} from '../ui/button';
import {Field} from '../ui/field';
import {localizeApiError} from '../../lib/i18n/ui-errors';

type ErrorResponse = {
  error?: {
    code?: string;
    message?: string;
  };
};

export function LoginForm() {
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const body = await response.json() as ErrorResponse;
      if (!response.ok) {
        setFormError(localizeApiError({
          code: body.error?.code,
          fallback: 'auth',
        }));
        return;
      }

      window.location.assign('/schedule');
    } catch {
      setFormError(localizeApiError({
        code: undefined,
        fallback: 'auth',
      }));
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-busy={pending}
      className="auth-form"
      noValidate
      onSubmit={handleSubmit}
    >
      {formError ? <Alert message={formError} /> : null}
      <Field htmlFor="email" label="Електронна пошта">
        <input
          autoComplete="username"
          autoFocus
          className="auth-input"
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          type="email"
        />
      </Field>
      <Field htmlFor="password" label="Пароль">
        <input
          autoComplete="current-password"
          className="auth-input"
          id="password"
          name="password"
          type="password"
        />
      </Field>
      <Button pending={pending} type="submit">
        Увійти
      </Button>
    </form>
  );
}
