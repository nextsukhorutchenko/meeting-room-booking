import {localizeApiError, uiFieldMessage, type BookingFieldKey} from
  '../../lib/i18n/ui-errors';
import type {DomainErrorCode} from '../../lib/http/domain-error';
import type {BookingEndTimeOption} from '../../modules/bookings/end-time-options';
import type {StartSlotSelection} from './booking-selection';
import type {ScheduleBooking, ScheduleData} from './schedule-types';

type BookingDraftState = {
  status:
    | 'editing'
    | 'submitting'
    | 'conflictRefreshing'
    | 'conflictError'
    | 'startUnavailable';
  selection: StartSlotSelection;
  title: string;
  endsAt: string;
  endOptions: readonly BookingEndTimeOption[];
  fieldErrors: Partial<Record<BookingFieldKey, string>>;
  formError: string;
  liveMessage: string;
  selectionGeneration: number;
  createRequestId: number | null;
  conflictGeneration: number;
};

export type BookingControllerState =
  | {status: 'closed'; selectionGeneration: number}
  | {
      status: 'details';
      booking: ScheduleBooking;
      selectionGeneration: number;
    }
  | BookingDraftState;

export type BookingRefreshOkEvent = {
  type: 'REFRESH_OK';
  conflictGeneration: number;
  options: readonly BookingEndTimeOption[];
};

export type BookingControllerEvent =
  | {type: 'SELECT_SLOT'; selection: StartSlotSelection;
      options: readonly BookingEndTimeOption[]}
  | {type: 'OPEN_DETAILS'; booking: ScheduleBooking}
  | {type: 'TITLE_CHANGED'; value: string}
  | {type: 'END_CHANGED'; endsAt: string}
  | {type: 'VALIDATION_ERROR'; fields: Partial<Record<BookingFieldKey, string>>}
  | {type: 'SUBMIT'; requestId: number}
  | {type: 'CREATE_OK'; requestId: number; booking: ScheduleBooking}
  | {type: 'CREATE_DOMAIN_ERROR'; requestId: number;
      code: DomainErrorCode;
      fields: Partial<Record<BookingFieldKey, string>>}
  | {type: 'CREATE_TRANSPORT_ERROR'; requestId: number}
  | BookingRefreshOkEvent
  | {type: 'REFRESH_ERROR'; conflictGeneration: number}
  | {type: 'RETRY_REFRESH'}
  | {type: 'CLOSE'}
  | {type: 'NAVIGATE_ROOM_WEEK_DAY'};

function closed(selectionGeneration: number): BookingControllerState {
  return {selectionGeneration, status: 'closed'};
}

function localizeFields(
  fields: Partial<Record<BookingFieldKey, string>>,
): Partial<Record<BookingFieldKey, string>> {
  const mapped: Partial<Record<BookingFieldKey, string>> = {};
  for (const field of Object.keys(fields) as BookingFieldKey[]) {
    mapped[field] = uiFieldMessage[field];
  }
  return mapped;
}

function startUnavailable(state: BookingDraftState): BookingDraftState {
  return {
    ...state,
    createRequestId: null,
    endsAt: '',
    endOptions: [],
    formError: '',
    liveMessage: 'Цей час початку більше недоступний. Оберіть інший слот.',
    status: 'startUnavailable',
  };
}

export function bookingReducer(
  state: BookingControllerState,
  event: BookingControllerEvent,
): BookingControllerState {
  switch (event.type) {
    case 'SELECT_SLOT': {
      if (
        'selection' in state &&
        (state.status === 'submitting' || state.status === 'conflictRefreshing')
      ) {
        return state;
      }
      const selectionGeneration = state.selectionGeneration + 1;
      const next: BookingDraftState = {
        conflictGeneration: 0,
        createRequestId: null,
        endOptions: event.options,
        endsAt: event.options[0]?.endsAt ?? '',
        fieldErrors: {},
        formError: '',
        liveMessage: '',
        selection: event.selection,
        selectionGeneration,
        status: 'editing',
        title: '',
      };
      return event.options.length === 0 ? startUnavailable(next) : next;
    }
    case 'OPEN_DETAILS':
      return {
        booking: event.booking,
        selectionGeneration: state.selectionGeneration,
        status: 'details',
      };
    case 'TITLE_CHANGED':
      return 'selection' in state && state.status === 'editing' ? {
        ...state,
        fieldErrors: {...state.fieldErrors, title: undefined},
        formError: '',
        title: event.value,
      } : state;
    case 'END_CHANGED':
      return 'selection' in state && state.status === 'editing' &&
        state.endOptions.some((option) => option.endsAt === event.endsAt) ? {
        ...state,
        formError: '',
        liveMessage: '',
        endsAt: event.endsAt,
      } : state;
    case 'SUBMIT':
      return 'selection' in state && state.status === 'editing' ? {
        ...state,
        createRequestId: event.requestId,
        fieldErrors: {},
        formError: '',
        liveMessage: '',
        status: 'submitting',
      } : state;
    case 'VALIDATION_ERROR':
      return 'selection' in state && state.status === 'editing' ? {
        ...state,
        fieldErrors: localizeFields(event.fields),
        formError: localizeApiError({
          code: 'VALIDATION_FAILED',
          fallback: 'booking',
        }),
      } : state;
    case 'CREATE_OK':
      return 'selection' in state && state.status === 'submitting' &&
        state.createRequestId === event.requestId ?
        closed(state.selectionGeneration) : state;
    case 'CREATE_DOMAIN_ERROR': {
      if (!('selection' in state) || state.status !== 'submitting' ||
        state.createRequestId !== event.requestId) {
        return state;
      }
      const base = {
        ...state,
        createRequestId: null,
        fieldErrors: localizeFields(event.fields),
        formError: localizeApiError({code: event.code, fallback: 'booking'}),
      };
      return event.code === 'BOOKING_CONFLICT' ? {
        ...base,
        conflictGeneration: state.conflictGeneration + 1,
        status: 'conflictRefreshing',
      } : {...base, status: 'editing'};
    }
    case 'CREATE_TRANSPORT_ERROR':
      return 'selection' in state && state.status === 'submitting' &&
        state.createRequestId === event.requestId ? {
        ...state,
        createRequestId: null,
        formError: localizeApiError({
          code: 'UNKNOWN_TRANSPORT',
          fallback: 'booking',
        }),
        status: 'editing',
      } : state;
    case 'REFRESH_OK': {
      if (!('selection' in state) || state.status !== 'conflictRefreshing' ||
        state.conflictGeneration !== event.conflictGeneration) {
        return state;
      }
      if (event.options.length === 0) {
        return startUnavailable({...state, endOptions: event.options});
      }
      const endsAtIsAvailable = event.options.some(
        (option) => option.endsAt === state.endsAt,
      );
      return {
        ...state,
        createRequestId: null,
        endOptions: event.options,
        endsAt: endsAtIsAvailable ? state.endsAt : event.options[0].endsAt,
        fieldErrors: {},
        formError: '',
        liveMessage: endsAtIsAvailable ? '' :
          'Час завершення змінено відповідно до доступності',
        status: 'editing',
      };
    }
    case 'REFRESH_ERROR':
      return 'selection' in state && state.status === 'conflictRefreshing' &&
        state.conflictGeneration === event.conflictGeneration ? {
        ...state,
        createRequestId: null,
        formError: 'Не вдалося оновити доступність.',
        status: 'conflictError',
      } : state;
    case 'RETRY_REFRESH':
      return 'selection' in state && state.status === 'conflictError' ? {
        ...state,
        conflictGeneration: state.conflictGeneration + 1,
        formError: '',
        status: 'conflictRefreshing',
      } : state;
    case 'CLOSE':
    case 'NAVIGATE_ROOM_WEEK_DAY':
      return closed(state.selectionGeneration + 1);
  }
}

export type ConflictRefreshSuccessPorts = {
  activeConflictGeneration: number;
  buildOptions(schedule: ScheduleData): readonly BookingEndTimeOption[];
  commitSchedule(schedule: ScheduleData): void;
  dispatch(event: BookingRefreshOkEvent): void;
};

export function applyConflictRefreshSuccess(input: {
  conflictGeneration: number;
  schedule: ScheduleData;
}, ports: ConflictRefreshSuccessPorts): void {
  if (input.conflictGeneration !== ports.activeConflictGeneration) return;
  ports.commitSchedule(input.schedule);
  const options = ports.buildOptions(input.schedule);
  ports.dispatch({
    conflictGeneration: input.conflictGeneration,
    options,
    type: 'REFRESH_OK',
  });
}
