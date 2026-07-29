import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const navigation = vi.hoisted(() => ({pathname: '/schedule'}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
}));

vi.mock('../../src/components/app/notification-bell', () => ({
  NotificationBell: () => <span>Сповіщення</span>,
}));

import {AppShell} from '../../src/components/app/app-shell';
import {usePresentationCoordinator} from
  '../../src/components/app/presentation-coordinator';

function ModalProbe() {
  const {modalOwner, request} = usePresentationCoordinator();
  return (
    <>
      <output>{modalOwner}</output>
      <button onClick={(event) => request({
        trigger: event.currentTarget,
        type: 'OPEN_FILTER',
      })} type="button">Open filter</button>
      <button onClick={() => request({type: 'OPEN_BOOKING'})} type="button">
        Open booking
      </button>
      <button onClick={(event) => request({
        origin: {invoker: event.currentTarget, kind: 'schedule'},
        type: 'OPEN_CANCEL_DIRECT',
      })} type="button">Open cancellation</button>
    </>
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Ukrainian navigation and a mobile bottom navigation', () => {
    render(
      <AppShell user={{name: 'Олена'}}>
        <p>Вміст</p>
      </AppShell>,
    );

    expect(screen.getAllByRole('link', {name: 'Розклад'})).toHaveLength(2);
    expect(screen.getAllByRole('link', {name: 'Мої бронювання'})).toHaveLength(2);
    expect(screen.getByText('Бронювання переговорних')).toBeVisible();
    expect(screen.getByRole('main', {name: 'Основний вміст'})).toHaveTextContent(
      'Вміст',
    );
  });

  it.each([
    ['Open filter', 'filter'],
    ['Open booking', 'booking'],
    ['Open cancellation', 'cancellation'],
  ])('clears %s ownership after an authenticated pathname transition', async (
    command,
    owner,
  ) => {
    navigation.pathname = '/schedule';
    const user = userEvent.setup();
    const view = render(
      <AppShell user={{name: 'Олена'}}><ModalProbe /></AppShell>,
    );
    const shell = view.container.querySelector('.app-shell');
    expect(shell).not.toBeNull();
    const app = within(view.container);

    await user.click(app.getByRole('button', {name: command}));
    expect(app.getByText(owner, {selector: 'output'})).toBeVisible();
    expect(shell).toHaveAttribute('inert');

    navigation.pathname = '/my-bookings';
    view.rerender(
      <AppShell user={{name: 'Олена'}}><ModalProbe /></AppShell>,
    );

    expect(app.getByText('none', {selector: 'output'})).toBeVisible();
    expect(shell).not.toHaveAttribute('inert');
    await user.click(app.getByRole('button', {name: 'Open filter'}));
    expect(app.getByText('filter', {selector: 'output'})).toBeVisible();
  });
});
