import '@testing-library/jest-dom/vitest';
import {render, screen, waitFor} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import VerifyPage from '../../src/app/verify/page';

const verificationUrl =
  '/verify?token=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

afterEach(() => {
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

    render(<VerifyPage />);

    expect(
      screen.getByRole('heading', {name: 'Verifying your email'}),
    ).toBeVisible();
    resolveResponse(new Response(
      JSON.stringify({data: {verified: true}}),
      {status: 200, headers: {'content-type': 'application/json'}},
    ));

    await expect(
      screen.findByRole('heading', {name: 'Email verified'}),
    ).resolves.toBeVisible();
    expect(screen.getByRole('link', {name: 'Go to schedule'})).toHaveAttribute(
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
      screen.findByRole('heading', {name: 'Verification link expired'}),
    ).resolves.toBeVisible();
    expect(screen.getByRole('link', {name: 'Back to schedule'})).toHaveAttribute(
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
      screen.findByRole('heading', {name: 'Verification unavailable'}),
    ).resolves.toBeVisible();
    expect(screen.getByText(
      'We could not verify your email. Try the development link again.',
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
        screen.getByRole('heading', {name: 'Verification link invalid'}),
      ).toBeVisible();
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
