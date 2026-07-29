import '@testing-library/jest-dom/vitest';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

vi.mock('../../src/components/app/notification-bell', () => ({
  NotificationBell: () => <span>Сповіщення</span>,
}));

import {AppShell} from '../../src/components/app/app-shell';

describe('AppShell', () => {
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
});
