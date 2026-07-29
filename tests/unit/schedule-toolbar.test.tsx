import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {Settings} from 'luxon';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ScheduleNavigation} from
  '../../src/components/schedule/schedule-navigation';

const originalLocale = Settings.defaultLocale;

describe('ScheduleNavigation locale', () => {
  afterEach(() => {
    cleanup();
    Settings.defaultLocale = originalLocale;
  });

  it('uses the application locale instead of the ambient locale', () => {
    Settings.defaultLocale = 'fr-FR';
    render(
      <ScheduleNavigation
        onDayChange={vi.fn()}
        onJump={vi.fn()}
        onNextDay={vi.fn()}
        onNextWeek={vi.fn()}
        onPreviousDay={vi.fn()}
        onPreviousWeek={vi.fn()}
        onToday={vi.fn()}
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
        selectedDay="2026-03-02"
        userTimeZone="Europe/Kyiv"
        weekStart="2026-03-02"
      />,
    );

    expect(screen.getByRole('navigation', {
      name: 'Навігація розкладом',
    })).toBeVisible();
    expect(screen.getByRole('button', {name: 'Попередній тиждень'}))
      .toBeVisible();
    expect(screen.getByRole('button', {name: 'Сьогодні'})).toBeVisible();
    expect(screen.getByText('бер. 2 - бер. 8, 2026')).toBeVisible();
    expect(screen.getByRole('button', {
      name: 'понеділок, березень 2',
    })).toBeVisible();
  });

  it('labels date-crossing jump values with user and office context', () => {
    render(
      <ScheduleNavigation
        onDayChange={vi.fn()}
        onJump={vi.fn()}
        onNextDay={vi.fn()}
        onNextWeek={vi.fn()}
        onPreviousDay={vi.fn()}
        onPreviousWeek={vi.fn()}
        onToday={vi.fn()}
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
        selectedDay="2026-07-29"
        userTimeZone="America/Los_Angeles"
        weekStart="2026-07-27"
      />,
    );

    expect(screen.getByRole('option', {
      name: /28 лип.*23:00.*офіс.*29 лип.*09:00/,
    })).toHaveValue('2026-07-29T06:00:00.000Z');
  });
});
