import {describe, expect, it, vi} from 'vitest';
import type {BookingEndTimeOption} from '../../src/modules/bookings/end-time-options';
import type {StartSlotSelection} from '../../src/components/schedule/booking-selection';
import type {ScheduleData} from '../../src/components/schedule/schedule-types';
import {
  applyConflictRefreshSuccess,
  bookingReducer,
  type BookingControllerState,
} from '../../src/components/schedule/booking-controller';

const selection: StartSlotSelection = {
  dateLabel: 'Вівторок, 4 серпня',
  roomId: 'oak',
  roomName: 'Дуб',
  startsAt: '2026-08-04T08:00:00.000Z',
  startTimeLabel: '11:00',
  timeZoneLabel: 'Europe/Kyiv',
};

const options: readonly BookingEndTimeOption[] = [{
  durationLabel: '30 хв',
  durationMinutes: 30,
  endsAt: '2026-08-04T08:30:00.000Z',
  endTimeLabel: '11:30',
  rangeLabel: '11:00-11:30',
}];

const refreshedOptions: readonly BookingEndTimeOption[] = [{
  durationLabel: '30 хв',
  durationMinutes: 30,
  endsAt: '2026-08-04T09:00:00.000Z',
  endTimeLabel: '12:00',
  rangeLabel: '11:00-12:00',
}];

const refreshedSchedule: ScheduleData = {
  bookings: [],
  officeTimeZone: 'Europe/Kyiv',
  officeWeekStart: '2026-08-03',
  range: {
    endsAt: '2026-08-10T21:00:00.000Z',
    startsAt: '2026-08-03T21:00:00.000Z',
  },
  room: {capacity: 6, floor: 1, id: 'oak', name: 'Дуб'},
};

const closedState: BookingControllerState = {
  selectionGeneration: 0,
  status: 'closed',
};

const conflictRefreshingState: BookingControllerState = {
  conflictGeneration: 3,
  createRequestId: 3,
  endOptions: options,
  endsAt: options[0].endsAt,
  fieldErrors: {},
  formError: 'Цей час уже зайнято.',
  liveMessage: '',
  selection,
  selectionGeneration: 1,
  status: 'conflictRefreshing',
  title: 'Планування',
};

describe('bookingReducer', () => {
  it('defaults a new selection to the first thirty-minute option', () => {
    const state = bookingReducer(closedState, {
      options,
      selection,
      type: 'SELECT_SLOT',
    });

    expect(state).toMatchObject({
      endsAt: options[0].endsAt,
      status: 'editing',
      title: '',
    });
  });

  it('retains the title and replaces a removed end after conflict refresh', () => {
    const state = bookingReducer(conflictRefreshingState, {
      conflictGeneration: 3,
      options: refreshedOptions,
      type: 'REFRESH_OK',
    });

    expect(state).toMatchObject({
      endsAt: refreshedOptions[0].endsAt,
      liveMessage: 'Час завершення змінено відповідно до доступності',
      status: 'editing',
      title: 'Планування',
    });
  });

  it.each(['submitting', 'conflictRefreshing'] as const)(
    'does not replace a %s draft when another slot is selected',
    (status) => {
      const pendingState: BookingControllerState = {
        ...conflictRefreshingState,
        status,
      };

      expect(bookingReducer(pendingState, {
        options: refreshedOptions,
        selection: {...selection, startsAt: '2026-08-04T09:00:00.000Z'},
        type: 'SELECT_SLOT',
      })).toBe(pendingState);
    },
  );

  it('sets validation errors without entering the submitting state', () => {
    const editingState = bookingReducer(closedState, {
      options,
      selection,
      type: 'SELECT_SLOT',
    });
    const state = bookingReducer(editingState, {
      fields: {title: 'ignored server detail'},
      type: 'VALIDATION_ERROR',
    });

    expect(state).toMatchObject({
      fieldErrors: {title: 'Назва має містити від 1 до 100 символів.'},
      status: 'editing',
    });
  });
});

describe('applyConflictRefreshSuccess', () => {
  it('commits refreshed schedule before dispatching reducer options', () => {
    const commitSchedule = vi.fn();
    const dispatch = vi.fn();

    applyConflictRefreshSuccess({
      conflictGeneration: 3,
      schedule: refreshedSchedule,
    }, {
      activeConflictGeneration: 3,
      buildOptions: () => refreshedOptions,
      commitSchedule,
      dispatch,
    });

    expect(commitSchedule).toHaveBeenCalledWith(refreshedSchedule);
    expect(commitSchedule.mock.invocationCallOrder[0]).toBeLessThan(
      dispatch.mock.invocationCallOrder[0],
    );
    expect(dispatch).toHaveBeenCalledWith({
      conflictGeneration: 3,
      options: refreshedOptions,
      type: 'REFRESH_OK',
    });
  });
});
