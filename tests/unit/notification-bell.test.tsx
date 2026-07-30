import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {NotificationCenter} from '../../src/components/app/notification-center';
import type {RetainedNotification} from
  '../../src/components/app/notification-controller';
import {PresentationCoordinator} from
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
      <NotificationCenter
        notifications={[retained]}
        onDismiss={vi.fn()}
        onOpenChange={setOpen}
        open={open}
        mode="mobile"
      />
    </PresentationCoordinator>
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
});
