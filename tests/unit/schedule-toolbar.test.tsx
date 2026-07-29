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
        onNextDay={vi.fn()}
        onNextWeek={vi.fn()}
        onPreviousDay={vi.fn()}
        onPreviousWeek={vi.fn()}
        onToday={vi.fn()}
        selectedDay="2026-03-02"
        weekStart="2026-03-02"
      />,
    );

    expect(screen.getByText('бер. 2 - бер. 8, 2026')).toBeVisible();
    expect(screen.getByRole('button', {
      name: 'понеділок, березень 2',
    })).toBeVisible();
  });
});
