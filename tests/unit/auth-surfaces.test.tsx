import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {AuthShell} from '../../src/components/auth/auth-shell';
import {LoginForm} from '../../src/components/auth/login-form';
import {RegisterForm} from '../../src/components/auth/register-form';

describe('auth surfaces', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses password-manager compatible login fields', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText('Електронна пошта')).toHaveAttribute(
      'autocomplete',
      'username',
    );
    expect(screen.getByLabelText('Пароль')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('renders the shared Roomwork auth composition', () => {
    render(
      <AuthShell heading="Увійдіть">
        <p>Форма входу</p>
      </AuthShell>,
    );

    expect(screen.getByText('Roomwork')).toBeVisible();
    expect(screen.getByText('Бронювання переговорних')).toBeVisible();
    expect(screen.getByRole('heading', {name: 'Увійдіть'})).toBeVisible();
    expect(screen.getByText('Форма входу')).toBeVisible();
  });

  it('localizes registration field labels and password manager metadata', () => {
    render(<RegisterForm />);

    expect(screen.getByLabelText("Ім'я")).toHaveAttribute(
      'autocomplete',
      'name',
    );
    expect(screen.getByLabelText('Електронна пошта')).toHaveAttribute(
      'autocomplete',
      'email',
    );
    expect(screen.getByLabelText('Пароль')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
  });
});
