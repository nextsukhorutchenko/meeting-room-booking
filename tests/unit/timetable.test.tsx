import '@testing-library/jest-dom/vitest';
import {readFileSync} from 'node:fs';
import {chromium} from '@playwright/test';
import {render, screen} from '@testing-library/react';
import {Settings} from 'luxon';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {Timetable} from '../../src/components/schedule/timetable';
import type {ScheduleBooking} from '../../src/components/schedule/schedule-types';

const weekStart = '2026-07-27';
const sevenDays = [
  '2026-07-27',
  '2026-07-28',
  '2026-07-29',
  '2026-07-30',
  '2026-07-31',
  '2026-08-01',
  '2026-08-02',
] as const;

const fourHourBooking: ScheduleBooking = {
  id: 'quarter-planning',
  title: 'Планування кварталу',
  startsAt: '2026-07-27T06:00:00.000Z',
  endsAt: '2026-07-27T10:00:00.000Z',
  author: {id: 'organizer', name: 'Олена Організаторка'},
  isOwn: false,
};

const longBooking: ScheduleBooking = {
  id: 'long-title',
  title: 'Плануваннябезперервногозаголовкадляперевіркикомпактногоосередку',
  startsAt: '2026-07-27T06:00:00.000Z',
  endsAt: '2026-07-27T06:30:00.000Z',
  author: {id: 'organizer', name: 'Олена Організаторка'},
  isOwn: false,
};

function renderTimetable(
  bookings: readonly ScheduleBooking[] = [],
  visibleDays: readonly string[] = sevenDays,
) {
  return render(
    <Timetable
      bookings={bookings}
      highlightedBookingId={null}
      now="2026-07-20T06:00:00.000Z"
      officeCloseHour={19}
      officeOpenHour={9}
      officeTimeZone="Europe/Kyiv"
      onOpenDetails={vi.fn()}
      onSelectSlot={vi.fn()}
      room={{id: 'maple', name: 'Maple', floor: 3, capacity: 8}}
      userTimeZone="Europe/Kyiv"
      visibleDays={visibleDays}
      weekStart={weekStart}
    />,
  );
}

describe('Timetable', () => {
  const originalNow = Settings.now;

  beforeEach(() => {
    Settings.now = () => Date.UTC(2026, 6, 20, 6);
  });

  afterEach(() => {
    Settings.now = originalNow;
  });

  it('renders a native seven-day table with twenty row headers', () => {
    renderTimetable();

    expect(screen.getByRole('table', {
      name: /Розклад переговорної Maple/,
    })).toBeVisible();
    expect(screen.getAllByRole('rowheader')).toHaveLength(20);
    expect(screen.getAllByRole('columnheader')).toHaveLength(8);
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('renders one four-hour booking cell with rowSpan eight', () => {
    renderTimetable([fourHourBooking]);

    expect(screen.getByRole('cell', {name: /Планування кварталу/}))
      .toHaveAttribute('rowspan', '8');
  });

  it('keeps long title, range and status inside a compact booking trigger', () => {
    renderTimetable([longBooking]);

    const trigger = screen.getByRole('button', {name: /Плануваннябезперервного/});
    expect(trigger.querySelector('[data-booking-title]')).toBeVisible();
    expect(trigger).toHaveTextContent('09:00–09:30');
    expect(trigger).toHaveTextContent('Зайнято');
    expect(trigger.querySelector('[aria-label^="Скасувати"]')).toBeNull();
  });

  it('contains the compact title, status, icon and full range at the token-derived seven-day width', async () => {
    const baseCss = readFileSync('src/app/styles/base.css', 'utf8');
    const timetableCss = readFileSync('src/app/styles/timetable.css', 'utf8');
    const tokensCss = readFileSync('src/app/styles/tokens.css', 'utf8');
    const tokenValue = (name: string) => {
      const match = tokensCss.match(new RegExp(`--${name}:\\s*([\\d.]+)px;`));
      if (!match) throw new Error(`Missing pixel token: ${name}`);
      return Number(match[1]);
    };
    const tableWidth = tokenValue('timetable-min-width');
    const browser = await chromium.launch();

    try {
      const page = await browser.newPage({
        viewport: {height: 320, width: tableWidth},
      });
      await page.setContent(`
        <style>${tokensCss}\n${baseCss}\n${timetableCss}</style>
        <table class="timetable">
          <thead><tr><th>Час</th>${sevenDays.map((day) =>
            `<th>${day}</th>`).join('')}</tr></thead>
          <tbody><tr><th>09:00</th>
            <td data-compact-day-cell>
              <button class="booking-block" type="button">
                <span class="booking-block-heading">
                  <span data-booking-title>Плануваннябезперервногозаголовкадляперевіркикомпактногоосередку</span>
                  <span class="booking-other-label"><svg></svg>Зайнято</span>
                </span>
                <span class="booking-block-meta">
                  <span class="booking-time-label">09:00–09:30</span>
                </span>
              </button>
            </td>
            ${sevenDays.slice(1).map(() => '<td></td>').join('')}
          </tr></tbody>
        </table>
      `);

      const geometry = await page.evaluate(() => {
        const trigger = document.querySelector<HTMLElement>('.booking-block');
        const cell = document.querySelector<HTMLElement>('[data-compact-day-cell]');
        const table = document.querySelector<HTMLElement>('.timetable');
        const heading = document.querySelector<HTMLElement>('.booking-block-heading');
        const title = document.querySelector<HTMLElement>('[data-booking-title]');
        const status = document.querySelector<HTMLElement>('.booking-other-label');
        const icon = status?.querySelector<HTMLElement>('svg');
        const time = document.querySelector<HTMLElement>('.booking-time-label');
        if (!trigger || !cell || !table || !heading || !title || !status || !icon || !time) {
          throw new Error('Compact booking fixture is incomplete.');
        }
        const triggerStyle = getComputedStyle(trigger);
        const rect = (element: HTMLElement) => element.getBoundingClientRect();
        const triggerRect = rect(trigger);
        const inner = {
          bottom: triggerRect.bottom - parseFloat(triggerStyle.borderBottomWidth) -
            parseFloat(triggerStyle.paddingBottom),
          left: triggerRect.left + parseFloat(triggerStyle.borderLeftWidth) +
            parseFloat(triggerStyle.paddingLeft),
          right: triggerRect.right - parseFloat(triggerStyle.borderRightWidth) -
            parseFloat(triggerStyle.paddingRight),
          top: triggerRect.top + parseFloat(triggerStyle.borderTopWidth) +
            parseFloat(triggerStyle.paddingTop),
        };
        return {
          cell: rect(cell).toJSON(),
          heading: rect(heading).toJSON(),
          icon: rect(icon).toJSON(),
          inner,
          status: {...rect(status).toJSON(), clientWidth: status.clientWidth, scrollWidth: status.scrollWidth},
          time: {...rect(time).toJSON(), clientWidth: time.clientWidth, scrollWidth: time.scrollWidth},
          table: rect(table).toJSON(),
          title: rect(title).toJSON(),
          trigger: {
            ...triggerRect.toJSON(),
            boxSizing: triggerStyle.boxSizing,
            clientWidth: trigger.clientWidth,
            scrollWidth: trigger.scrollWidth,
          },
        };
      });

      expect(baseCss).toMatch(/\*\s*,[\s\S]*box-sizing: border-box;/);
      expect(timetableCss).toMatch(/border-collapse: collapse;/);
      expect(timetableCss).toMatch(/table-layout: fixed;/);
      expect(geometry.trigger.boxSizing).toBe('border-box');
      expect(geometry.table.width).toBeCloseTo(tableWidth, 1);
      expect(geometry.cell.width).toBeGreaterThan(0);
      expect(geometry.trigger.left).toBeGreaterThanOrEqual(geometry.cell.left);
      expect(geometry.trigger.right).toBeLessThanOrEqual(geometry.cell.right);
      expect(geometry.title.left).toBeGreaterThanOrEqual(geometry.inner.left);
      expect(geometry.title.right).toBeLessThanOrEqual(geometry.status.left);
      expect(geometry.status.left).toBeGreaterThanOrEqual(geometry.inner.left);
      expect(geometry.status.right).toBeLessThanOrEqual(geometry.inner.right);
      expect(geometry.icon.left).toBeGreaterThanOrEqual(geometry.status.left);
      expect(geometry.icon.right).toBeLessThanOrEqual(geometry.status.right);
      expect(geometry.time.left).toBeGreaterThanOrEqual(geometry.inner.left);
      expect(geometry.time.right).toBeLessThanOrEqual(geometry.inner.right);
      expect(geometry.heading.bottom).toBeLessThanOrEqual(geometry.time.top);
      expect(geometry.status.scrollWidth).toBeLessThanOrEqual(
        geometry.status.clientWidth,
      );
      expect(geometry.time.scrollWidth).toBeLessThanOrEqual(
        geometry.time.clientWidth,
      );
      expect(geometry.trigger.scrollWidth).toBeLessThanOrEqual(
        geometry.trigger.clientWidth,
      );
    } finally {
      await browser.close();
    }
  }, 30_000);

  it('labels the current-day header with visible non-color text', () => {
    render(
      <Timetable
        bookings={[]}
        highlightedBookingId={null}
        now="2026-07-29T06:00:00.000Z"
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="Europe/Kyiv"
        onOpenDetails={vi.fn()}
        onSelectSlot={vi.fn()}
        room={{id: 'maple', name: 'Maple', floor: 3, capacity: 8}}
        userTimeZone="Europe/Kyiv"
        visibleDays={sevenDays}
        weekStart={weekStart}
      />,
    );

    const currentHeader = screen.getByRole('columnheader', {
      name: /Сьогодні/,
    });
    expect(currentHeader).toHaveAttribute('aria-current', 'date');
    expect(currentHeader).toHaveTextContent('Сьогодні');
  });

  it.each([
    {
      booking: {
        ...fourHourBooking,
        id: 'same-zone',
        startsAt: '2026-03-02T07:00:00.000Z',
        endsAt: '2026-03-02T07:30:00.000Z',
        title: 'Одна зона',
      },
      label: /2 березня 2026.*09:00.*2 березня 2026.*09:30.*Europe\/Kyiv/,
      userTimeZone: 'Europe/Kyiv',
      visibleDays: ['2026-03-02'],
      weekStart: '2026-03-02',
    },
    {
      booking: {
        ...fourHourBooking,
        id: 'different-zone',
        startsAt: '2026-03-02T07:00:00.000Z',
        endsAt: '2026-03-02T07:30:00.000Z',
        title: 'Різні зони',
      },
      label: /2 березня 2026.*02:00.*America\/New_York.*09:00.*Europe\/Kyiv/,
      userTimeZone: 'America/New_York',
      visibleDays: ['2026-03-02'],
      weekStart: '2026-03-02',
    },
    {
      booking: {
        ...fourHourBooking,
        id: 'date-crossing',
        startsAt: '2026-07-29T06:00:00.000Z',
        endsAt: '2026-07-29T07:30:00.000Z',
        title: 'Перехід дати',
      },
      label: /28 липня 2026.*29 липня 2026.*America\/Los_Angeles.*29 липня 2026.*Europe\/Kyiv/,
      userTimeZone: 'America/Los_Angeles',
      visibleDays: ['2026-07-29'],
      weekStart,
    },
  ])(
    'gives $booking.title an unambiguous accessible range',
    ({booking, label, userTimeZone, visibleDays, weekStart: fixtureWeek}) => {
      render(
        <Timetable
          bookings={[booking]}
          highlightedBookingId={null}
          now="2026-02-01T00:00:00.000Z"
          officeCloseHour={19}
          officeOpenHour={9}
          officeTimeZone="Europe/Kyiv"
          onOpenDetails={vi.fn()}
          onSelectSlot={vi.fn()}
          room={{id: 'maple', name: 'Maple', floor: 3, capacity: 8}}
          userTimeZone={userTimeZone}
          visibleDays={visibleDays}
          weekStart={fixtureWeek}
        />,
      );

      expect(screen.getByRole('button', {name: label})).toBeVisible();
    },
  );

  it('keeps an empty slot as one accessible native action', () => {
    renderTimetable([], ['2026-07-27']);

    const slot = screen.getAllByRole('button', {name: /Забронювати.*Maple/})[0];
    expect(slot).toHaveTextContent('Вільно');
    expect(slot.querySelector('svg')).toBeTruthy();
  });
});
