import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {AuthShell} from '../../src/components/auth/auth-shell';
import {LoginForm} from '../../src/components/auth/login-form';
import {RegisterForm} from '../../src/components/auth/register-form';

const navigation = vi.hoisted(() => ({
  router: {replace: vi.fn()},
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navigation.router,
}));

describe('auth surfaces', () => {
  afterEach(() => {
    cleanup();
    navigation.router.replace.mockReset();
    vi.unstubAllGlobals();
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

  it.each([
    ['/my-bookings?scope=future', '/my-bookings?scope=future'],
    ['https://attacker.example/schedule', '/schedule'],
    ['/schedule/%2e%2e/my-bookings', '/schedule'],
  ])('routes a successful login from %s to %s', async (
    returnTo,
    expected,
  ) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({data: {user: {id: 'user-1'}}}),
      ok: true,
    }));
    render(<LoginForm returnTo={returnTo} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Електронна пошта'), 'user@example.com');
    await user.type(screen.getByLabelText('Пароль'), 'password123');
    await user.click(screen.getByRole('button', {name: 'Увійти'}));

    expect(navigation.router.replace).toHaveBeenCalledOnce();
    expect(navigation.router.replace).toHaveBeenCalledWith(expected);
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
