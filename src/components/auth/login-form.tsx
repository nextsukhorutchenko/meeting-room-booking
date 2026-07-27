'use client';

import {useState, type FormEvent} from 'react';
import {Alert} from '../ui/alert';
import {Button} from '../ui/button';
import {Field} from '../ui/field';

type ErrorResponse = {
  error?: {
    message?: string;
  };
};

const inputClassName = [
  'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2',
  'text-base text-slate-950 outline-none transition-shadow',
  'placeholder:text-slate-400 focus:border-blue-700 focus:ring-2',
  'focus:ring-blue-100',
].join(' ');

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
        setFormError(body.error?.message ?? 'Sign in failed');
        return;
      }

      window.location.assign('/schedule');
    } catch {
      setFormError('Unable to sign in right now. Please try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      aria-busy={pending}
      className="grid gap-5"
      noValidate
      onSubmit={handleSubmit}
    >
      {formError ? <Alert message={formError} /> : null}
      <Field htmlFor="email" label="Email">
        <input
          autoComplete="email"
          autoFocus
          className={inputClassName}
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          type="email"
        />
      </Field>
      <Field htmlFor="password" label="Password">
        <input
          autoComplete="current-password"
          className={inputClassName}
          id="password"
          name="password"
          type="password"
        />
      </Field>
      <Button pending={pending} type="submit">
        Sign in
      </Button>
    </form>
  );
}
