import '@testing-library/jest-dom/vitest';
import {readFileSync} from 'node:fs';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {Settings} from 'luxon';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {ScheduleNavigation} from
  '../../src/components/schedule/schedule-navigation';

const originalLocale = Settings.defaultLocale;
const originalNow = Settings.now;

describe('ScheduleNavigation locale', () => {
  afterEach(() => {
    cleanup();
    Settings.defaultLocale = originalLocale;
    Settings.now = originalNow;
  });

  it('uses the application locale instead of the ambient locale', () => {
    Settings.defaultLocale = 'fr-FR';
    render(
      <ScheduleNavigation
        mode="expanded"
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
      name: 'понеділок, березень 2, обрано',
    })).toBeVisible();
  });

  it('labels date-crossing jump values with user and office context', () => {
    render(
      <ScheduleNavigation
        mode="expanded"
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

  it('keeps seven source dates while exposing three mobile date controls', () => {
    render(
      <ScheduleNavigation
        mode="mobile"
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
        userTimeZone="Europe/Kyiv"
        weekStart="2026-07-27"
      />,
    );

    expect(document.querySelectorAll(
      '.schedule-date-strip [role="listitem"]',
    )).toHaveLength(7);
    expect(document.querySelectorAll(
      '[data-mobile-date-visible="true"]',
    )).toHaveLength(3);

    const css = readFileSync('src/app/styles/agenda.css', 'utf8');
    expect(css).toMatch(/\.schedule-date-strip \{[\s\S]*repeat\(3,/);
    expect(css).toMatch(/min-height:\s*var\(--timetable-row-height\)/);
    expect(css).toMatch(
      /\.schedule-jump-controls\s*\{[\s\S]*position:\s*absolute[\s\S]*clip-path:\s*inset\(50%\)/,
    );
    expect(css).toMatch(
      /\.schedule-jump-controls:focus-within\s*\{[\s\S]*clip-path:\s*none/,
    );
  });

  it.each(['medium', 'tablet', 'mobile'] as const)(
    'uses day navigation callbacks in %s mode',
    async (mode) => {
      const onNextDay = vi.fn();
      const onNextWeek = vi.fn();
      const onPreviousDay = vi.fn();
      const onPreviousWeek = vi.fn();
      const user = userEvent.setup();
      render(
        <ScheduleNavigation
          mode={mode}
          onDayChange={vi.fn()}
          onJump={vi.fn()}
          onNextDay={onNextDay}
          onNextWeek={onNextWeek}
          onPreviousDay={onPreviousDay}
          onPreviousWeek={onPreviousWeek}
          onToday={vi.fn()}
          officeCloseHour={19}
          officeOpenHour={9}
          officeTimeZone="Europe/Kyiv"
          selectedDay="2026-07-29"
          userTimeZone="Europe/Kyiv"
          weekStart="2026-07-27"
        />,
      );

      await user.click(screen.getByRole('button', {name: 'Попередній день'}));
      await user.click(screen.getByRole('button', {name: 'Наступний день'}));

      expect(onPreviousDay).toHaveBeenCalledOnce();
      expect(onNextDay).toHaveBeenCalledOnce();
      expect(onPreviousWeek).not.toHaveBeenCalled();
      expect(onNextWeek).not.toHaveBeenCalled();
    },
  );

  it('distinguishes the selected date from office today', () => {
    Settings.now = () => Date.UTC(2026, 6, 30, 9);
    render(
      <ScheduleNavigation
        mode="mobile"
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
        userTimeZone="Europe/Kyiv"
        weekStart="2026-07-27"
      />,
    );

    expect(screen.getByRole('button', {name: /середа.*обрано/i}))
      .toHaveAttribute('aria-current', 'date');
    expect(screen.getByRole('button', {name: /четвер.*сьогодні/i}))
      .toHaveAttribute('data-office-today', 'true');
  });

  it('keeps compact metadata out of the agenda geometry budget', () => {
    const agendaCss = readFileSync('src/app/styles/agenda.css', 'utf8');
    const layoutCss = readFileSync(
      'src/app/styles/schedule-layout.css',
      'utf8',
    );

    expect(layoutCss).toMatch(
      /@media \(max-width: 599px\)[\s\S]*\.schedule-page\s*\{[\s\S]*padding:\s*var\(--space-1\)\s+var\(--space-2\)/,
    );
    expect(layoutCss).toMatch(
      /@media \(max-width: 599px\)[\s\S]*\.schedule-title-row\s*\{[\s\S]*position:\s*absolute[\s\S]*clip-path:\s*inset\(50%\)/,
    );
    expect(layoutCss).toMatch(
      /@media \(max-width: 599px\)[\s\S]*\.empty-schedule-note\s*\{[\s\S]*position:\s*absolute[\s\S]*clip-path:\s*inset\(50%\)/,
    );
    expect(agendaCss).toMatch(
      /@media \(max-width: 599px\)[\s\S]*\.week-label\s*\{[\s\S]*display:\s*none/,
    );
    expect(agendaCss).toMatch(
      /@media \(max-width: 599px\)[\s\S]*\.day-agenda h2\s*\{[\s\S]*position:\s*absolute[\s\S]*clip-path:\s*inset\(50%\)/,
    );
  });
});
