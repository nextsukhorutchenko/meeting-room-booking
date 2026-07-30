import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {NotificationCenter} from '../../src/components/app/notification-center';
import type {RetainedNotification} from
  '../../src/components/app/notification-controller';
import {PresentationCoordinator} from
  '../../src/components/app/presentation-coordinator';
import {usePresentationCoordinator} from
  '../../src/components/app/presentation-coordinator';

const retained: RetainedNotification = {
  ack: 'acked',
  data: {
    currentTitle: 'Оновлена назва',
    endsAt: '2026-07-30T10:00:00.000Z',
    id: 'notification-1',
    nextAuthorName: 'Олена',
    roomName: 'Oak',
  },
  seen: true,
};

afterEach(cleanup);

function MobileCenterHarness() {
  const [open, setOpen] = useState(false);
  return (
    <PresentationCoordinator>
      <MobileCenterContent open={open} setOpen={setOpen} />
    </PresentationCoordinator>
  );
}

function MobileCenterContent({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen(open: boolean): void;
}) {
  const {registerBackground} = usePresentationCoordinator();
  return (
    <div data-testid="notification-background" ref={registerBackground}>
      <NotificationCenter
        notifications={[retained]}
        onDismiss={vi.fn()}
        onOpenChange={setOpen}
        open={open}
        mode="mobile"
      />
      <button type="button">Фонова дія</button>
    </div>
  );
}

describe('NotificationCenter', () => {
  it.each(['expanded', 'medium', 'tablet'] as const)(
    'renders %s notification center as a non-modal popover',
    (mode) => {
      render(
        <NotificationCenter
          notifications={[retained]}
          onDismiss={vi.fn()}
          onOpenChange={vi.fn()}
          open
          mode={mode}
        />,
      );

      expect(screen.getByRole('region', {name: 'Сповіщення'})).toBeVisible();
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    },
  );

  it('renders only mobile notification center as a modal sheet', () => {
    render(
      <NotificationCenter
        notifications={[retained]}
        onDismiss={vi.fn()}
        onOpenChange={vi.fn()}
        open
        mode="mobile"
      />,
    );

    expect(screen.getByRole('dialog', {name: 'Сповіщення'}))
      .toHaveAttribute('aria-modal', 'true');
  });

  it('uses the presentation coordinator for a mobile notification sheet', async () => {
    render(<MobileCenterHarness />);

    await userEvent.setup().click(screen.getByRole('button', {
      name: 'Сповіщення, 0 нових',
    }));

    expect(await screen.findByRole('dialog', {name: 'Сповіщення'}))
      .toHaveAttribute('aria-modal', 'true');
  });

  it('contains mobile focus and restores the bell after Escape', async () => {
    render(<MobileCenterHarness />);
    const user = userEvent.setup();
    const bell = screen.getByRole('button', {
      name: 'Сповіщення, 0 нових',
    });

    await user.click(bell);

    const dialog = await screen.findByRole('dialog', {name: 'Сповіщення'});
    const close = screen.getByRole('button', {
      name: 'Закрити сповіщення',
    });
    const dismiss = screen.getByRole('button', {
      name: 'Відхилити сповіщення',
    });
    await waitFor(() => expect(close).toHaveFocus());
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(document.querySelectorAll('[aria-modal="true"]')).toHaveLength(1);
    expect(screen.getByTestId('notification-background')).toHaveAttribute(
      'inert',
      '',
    );
    expect(screen.getByTestId('notification-background')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    await user.tab();
    expect(dismiss).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();
    await user.tab({shift: true});
    expect(dismiss).toHaveFocus();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(bell).toHaveFocus());
    expect(screen.queryByRole('dialog', {name: 'Сповіщення'}))
      .not.toBeInTheDocument();
    expect(screen.getByTestId('notification-background'))
      .not.toHaveAttribute('inert');
    expect(screen.getByTestId('notification-background'))
      .not.toHaveAttribute('aria-hidden');
  });
});
