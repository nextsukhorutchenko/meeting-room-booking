'use client';

import {useState, type FormEvent} from 'react';
import {Alert} from '../ui/alert';
import {Button} from '../ui/button';
import {Field} from '../ui/field';

type FormErrors = Record<string, string>;

type ErrorResponse = {
  error?: {
    fields?: FormErrors;
    message?: string;
  };
};

const inputClassName = [
  'min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2',
  'text-base text-slate-950 outline-none transition-shadow',
  'placeholder:text-slate-400 focus:border-blue-700 focus:ring-2',
  'focus:ring-blue-100 aria-invalid:border-red-600 aria-invalid:ring-red-100',
].join(' ');

export function RegisterForm() {
  const [fieldErrors, setFieldErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setPending(true);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {'content-type': 'application/json'},
        body: JSON.stringify({
          name: form.get('name'),
          email: form.get('email'),
          password: form.get('password'),
        }),
      });
      const body = await response.json() as ErrorResponse;
      if (!response.ok) {
        setFieldErrors(body.error?.fields ?? {});
        setFormError(body.error?.message ?? 'Registration failed');
        return;
      }

      window.location.assign('/schedule');
    } catch {
      setFormError('Unable to register right now. Please try again.');
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
      <Field error={fieldErrors.name} htmlFor="name" label="Name">
        <input
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          aria-invalid={Boolean(fieldErrors.name)}
          autoComplete="name"
          autoFocus
          className={inputClassName}
          id="name"
          maxLength={100}
          name="name"
          type="text"
        />
      </Field>
      <Field error={fieldErrors.email} htmlFor="email" label="Email">
        <input
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          aria-invalid={Boolean(fieldErrors.email)}
          autoComplete="email"
          className={inputClassName}
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          type="email"
        />
      </Field>
      <Field error={fieldErrors.password} htmlFor="password" label="Password">
        <input
          aria-describedby={
            fieldErrors.password ? 'password-error' : undefined
          }
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="new-password"
          className={inputClassName}
          id="password"
          name="password"
          type="password"
        />
      </Field>
      <Button pending={pending} type="submit">
        Create account
      </Button>
    </form>
  );
}
