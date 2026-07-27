import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {Settings} from 'luxon';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ScheduleToolbar} from
  '../../src/components/schedule/schedule-toolbar';

const originalLocale = Settings.defaultLocale;

describe('ScheduleToolbar locale', () => {
  afterEach(() => {
    cleanup();
    Settings.defaultLocale = originalLocale;
  });

  it('uses the application locale instead of the ambient locale', () => {
    Settings.defaultLocale = 'fr-FR';
    render(
      <ScheduleToolbar
        minCapacity=""
        onDayChange={vi.fn()}
        onMinCapacityChange={vi.fn()}
        onNextDay={vi.fn()}
        onNextWeek={vi.fn()}
        onPreviousDay={vi.fn()}
        onPreviousWeek={vi.fn()}
        onRoomChange={vi.fn()}
        onToday={vi.fn()}
        rooms={[]}
        selectedDay="2026-03-02"
        selectedRoomId=""
        weekStart="2026-03-02"
      />,
    );

    expect(screen.getByText('Mar 2 - Mar 8, 2026')).toBeVisible();
  });
});
