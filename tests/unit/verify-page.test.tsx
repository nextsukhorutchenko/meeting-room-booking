import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import {StrictMode} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import VerifyPage from '../../src/app/verify/page';

const verificationUrl =
  '/verify?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState({}, '', '/');
});

describe('VerifyPage', () => {
  it('shows pending and then success while posting the URL token', async () => {
    let resolveResponse!: (response: Response) => void;
    const response = new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
    const fetch = vi.fn(() => response);
    vi.stubGlobal('fetch', fetch);
    window.history.replaceState({}, '', verificationUrl);

    render(
      <StrictMode>
        <VerifyPage />
      </StrictMode>,
    );

    expect(
      screen.getByRole('heading', {name: 'Підтверджуємо email'}),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    await waitFor(() => {
      expect(window.location.pathname).toBe('/verify');
      expect(window.location.search).toBe('');
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    resolveResponse(new Response(
      JSON.stringify({data: {verified: true}}),
      {status: 200, headers: {'content-type': 'application/json'}},
    ));

    await expect(
      screen.findByRole('heading', {name: 'Email підтверджено'}),
    ).resolves.toBeVisible();
    expect(screen.getByRole('link', {name: 'До розкладу'})).toHaveAttribute(
      'href',
      '/schedule',
    );
    expect(fetch).toHaveBeenCalledWith('/api/auth/verify', {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({
        token: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      }),
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows the expired state for an invalid, expired, or consumed token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      error: {
        code: 'VERIFICATION_INVALID_OR_EXPIRED',
        message: 'Verification link is invalid or expired',
      },
    }), {status: 410, headers: {'content-type': 'application/json'}})));
    window.history.replaceState({}, '', verificationUrl);

    render(<VerifyPage />);

    await expect(
      screen.findByRole('heading', {name: 'Посилання підтвердження прострочене'}),
    ).resolves.toBeVisible();
    expect(screen.getByRole('link', {name: 'До розкладу'})).toHaveAttribute(
      'href',
      '/schedule',
    );
  });

  it('shows a stable error when verification cannot be completed', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('private network detail');
    }));
    window.history.replaceState({}, '', verificationUrl);

    render(<VerifyPage />);

    await expect(
      screen.findByRole('heading', {name: 'Підтвердження недоступне'}),
    ).resolves.toBeVisible();
    expect(screen.getByText(
      'Не вдалося підтвердити email. Спробуйте відкрити посилання ще раз.',
    )).toBeVisible();
    expect(screen.queryByText(/private network detail/i)).not.toBeInTheDocument();
  });

  it('rejects a missing token without sending a request', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    window.history.replaceState({}, '', '/verify');

    render(<VerifyPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', {name: 'Посилання підтвердження недійсне'}),
      ).toBeVisible();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
