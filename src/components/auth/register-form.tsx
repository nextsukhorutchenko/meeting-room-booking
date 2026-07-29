'use client';

import {useState, type FormEvent} from 'react';
import {Alert} from '../ui/alert';
import {Button} from '../ui/button';
import {Field} from '../ui/field';
import {localizeApiError, uiFieldMessage} from '../../lib/i18n/ui-errors';

type FormErrors = Record<string, string>;

type ErrorResponse = {
  error?: {
    code?: string;
    fields?: FormErrors;
    message?: string;
  };
};

const authFieldNames = ['name', 'email', 'password'] as const;

function localizeFieldErrors(errors: FormErrors | undefined): FormErrors {
  return Object.fromEntries(authFieldNames.flatMap((field) =>
    errors?.[field] ? [[field, uiFieldMessage[field]]] : [],
  ));
}

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
        setFieldErrors(localizeFieldErrors(body.error?.fields));
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
      <Field error={fieldErrors.name} htmlFor="name" label="Ім'я">
        <input
          aria-describedby={fieldErrors.name ? 'name-error' : undefined}
          aria-invalid={Boolean(fieldErrors.name)}
          autoComplete="name"
          autoFocus
          className="auth-input"
          id="name"
          maxLength={100}
          name="name"
          type="text"
        />
      </Field>
      <Field
        error={fieldErrors.email}
        htmlFor="email"
        label="Електронна пошта"
      >
        <input
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          aria-invalid={Boolean(fieldErrors.email)}
          autoComplete="email"
          className="auth-input"
          id="email"
          inputMode="email"
          maxLength={254}
          name="email"
          type="email"
        />
      </Field>
      <Field error={fieldErrors.password} htmlFor="password" label="Пароль">
        <input
          aria-describedby={
            fieldErrors.password ? 'password-error' : undefined
          }
          aria-invalid={Boolean(fieldErrors.password)}
          autoComplete="new-password"
          className="auth-input"
          id="password"
          name="password"
          type="password"
        />
      </Field>
      <Button pending={pending} type="submit">
        Створити обліковий запис
      </Button>
    </form>
  );
}
