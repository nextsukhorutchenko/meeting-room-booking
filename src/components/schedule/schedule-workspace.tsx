'use client';

import {Building2, SlidersHorizontal, UsersRound} from 'lucide-react';
import {DateTime} from 'luxon';
import {useRouter, useSearchParams} from 'next/navigation';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {getBrowserTimeZone} from '../../lib/time/browser-zone';
import {uiCopy} from '../../lib/i18n/ui-copy';
import {localizeApiError, uiFieldMessage} from '../../lib/i18n/ui-errors';
import {buildBookingEndTimeOptions} from '../../modules/bookings/end-time-options';
import {
  CancellationDialog,
  type CancellationSelection,
} from '../bookings/cancellation-dialog';
import {announceAuthRequired} from '../auth/auth-required-boundary';
import {usePresentationCoordinator} from '../app/presentation-coordinator';
import {Spinner} from '../ui/spinner';
import {Toast} from '../ui/toast';
import {AdaptiveBookingSurface} from './adaptive-booking-surface';
import {
  applyConflictRefreshSuccess,
  bookingReducer,
  type BookingControllerState,
} from './booking-controller';
import type {StartSlotSelection} from './booking-selection';
import {DayAgenda} from './day-agenda';
import {RoomFilterSurface} from './room-filter-surface';
import {RoomPicker} from './room-picker';
import {ScheduleNavigation, type ScheduleJumpTarget} from './schedule-navigation';
import {ScheduleViewport} from './schedule-viewport';
import type {
  RoomSummary,
  ScheduleBooking,
  ScheduleData,
} from './schedule-types';
import {TimezoneLabel} from './timezone-label';
import {
  getResponsiveMode,
  useResponsiveMode,
} from './use-responsive-mode';
import {Timetable} from './timetable';

type ApiResponse<T> = {
  data?: T;
  error?: {code?: string; fields?: Record<string, string>; message?: string};
};

type ScheduleLoadState =
  | {key: string; status: 'loading'}
  | {data: ScheduleData; key: string; status: 'success'}
  | {error: string; key: string; status: 'error'};

type ScheduleWorkspaceProps = {
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
};

class LocalizedRequestError extends Error {}

type ConflictRefreshTarget = {
  conflictGeneration: number;
  requestId: number;
  roomId: string;
  weekStart: string;
};

type CreatedBookingFocusTarget = {
  bookingId: string;
  focusGeneration: number;
  officeDay: string;
  requestId: number;
  roomId: string;
  scheduleKey: string;
  weekStart: string;
};

function currentOfficeWeek(officeTimeZone: string): string {
  return DateTime.now()
    .setZone(officeTimeZone)
    .startOf('week')
    .toFormat('yyyy-LL-dd');
}

function normalizeWeekStart(
  value: string | null,
  officeTimeZone: string,
): string {
  if (!value) {
    return currentOfficeWeek(officeTimeZone);
  }
  const parsed = DateTime.fromISO(value, {zone: officeTimeZone});
  return parsed.isValid && parsed.weekday === 1 ?
    parsed.toFormat('yyyy-LL-dd') :
    currentOfficeWeek(officeTimeZone);
}

function defaultDay(
  weekStart: string,
  officeTimeZone: string,
): string {
  const week = DateTime.fromISO(weekStart, {zone: officeTimeZone});
  const today = DateTime.now().setZone(officeTimeZone).startOf('day');
  return today >= week && today < week.plus({days: 7}) ?
    today.toFormat('yyyy-LL-dd') :
    weekStart;
}

function normalizeDay(
  value: string | null,
  weekStart: string,
  officeTimeZone: string,
): string {
  if (!value) {
    return defaultDay(weekStart, officeTimeZone);
  }
  const week = DateTime.fromISO(weekStart, {zone: officeTimeZone});
  const parsed = DateTime.fromISO(value, {zone: officeTimeZone});
  return parsed.isValid && parsed >= week && parsed < week.plus({days: 7}) ?
    parsed.toFormat('yyyy-LL-dd') :
    defaultDay(weekStart, officeTimeZone);
}

function visibleTimetableDays(
  selectedDay: string,
  visibleDayCount: 2 | 3 | 7,
  weekStart: string,
  officeTimeZone: string,
): readonly string[] {
  const week = DateTime.fromISO(weekStart, {zone: officeTimeZone});
  if (visibleDayCount === 7) {
    return Array.from({length: 7}, (_, index) =>
      week.plus({days: index}).toFormat('yyyy-LL-dd'));
  }
  const day = DateTime.fromISO(selectedDay, {zone: officeTimeZone});
  const selectedIndex = Math.max(0, Math.floor(day.diff(week, 'days').days));
  const startIndex = Math.min(selectedIndex, 7 - visibleDayCount);
  return Array.from({length: visibleDayCount}, (_, index) =>
    week.plus({days: startIndex + index}).toFormat('yyyy-LL-dd'));
}

function subscribeToBrowserTimeZone(): () => void {
  return () => undefined;
}

export function ScheduleWorkspace({
  officeCloseHour,
  officeOpenHour,
  officeTimeZone,
}: ScheduleWorkspaceProps) {
  const {modalOwner, request} = usePresentationCoordinator();
  const router = useRouter();
  const searchParams = useSearchParams();
  const linkedBookingId = searchParams.get('bookingId');
  const initialWeekStart = normalizeWeekStart(
    searchParams.get('weekStart'),
    officeTimeZone,
  );
  const [draftMinCapacity, setDraftMinCapacity] = useState('');
  const [appliedMinCapacity, setAppliedMinCapacity] = useState('');
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState(
    searchParams.get('roomId') ?? '',
  );
  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [selectedDay, setSelectedDay] = useState(
    normalizeDay(searchParams.get('day'), initialWeekStart, officeTimeZone),
  );
  const readBrowserTimeZone = useCallback(
    () => getBrowserTimeZone(officeTimeZone),
    [officeTimeZone],
  );
  const userTimeZone = useSyncExternalStore(
    subscribeToBrowserTimeZone,
    readBrowserTimeZone,
    () => officeTimeZone,
  );
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [roomsError, setRoomsError] = useState('');
  const [roomsRetryKey, setRoomsRetryKey] = useState(0);
  const [scheduleState, setScheduleState] =
    useState<ScheduleLoadState | null>(null);
  const [bookingState, dispatchBooking] = useReducer(bookingReducer, {
    selectionGeneration: 0,
    status: 'closed',
  } satisfies BookingControllerState);
  const [cancellation, setCancellation] = useState<{
    booking: CancellationSelection;
    error: string;
    pending: boolean;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [preservedScheduleKey, setPreservedScheduleKey] =
    useState<string | null>(null);
  const [isRoomFilterOpen, setIsRoomFilterOpen] = useState(false);
  const [visibleTimeAnchor, setVisibleTimeAnchor] = useState<string | null>(
    null,
  );
  const [agendaJumpStartsAt, setAgendaJumpStartsAt] = useState<string | null>(
    null,
  );
  const [positionEpoch, setPositionEpoch] = useState(0);
  const hasSettledInitialLoad = useRef(false);
  const positionedDayRef = useRef(selectedDay);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const weekStartRef = useRef(weekStart);
  const selectedDayRef = useRef(selectedDay);
  const roomsRequestSequence = useRef(0);
  const roomPickerRef = useRef<HTMLSelectElement>(null);
  const roomFilterTriggerRef = useRef<HTMLButtonElement>(null);
  const roomRetryButtonRef = useRef<HTMLButtonElement>(null);
  const restoreRoomRetryFocusRef = useRef(false);
  const bookingDetailsCancelButtonRef = useRef<HTMLButtonElement>(null);
  const bookingDetailsInvokerRef = useRef<HTMLElement | null>(null);
  const restoreBookingDetailsFocusRef = useRef(false);
  const scheduleRequestSequence = useRef(0);
  const preserveScheduleOnRefreshRef = useRef(false);
  const conflictRefreshRequestRef = useRef(false);
  const conflictRefreshGenerationRef = useRef(0);
  const conflictRefreshTargetRef = useRef<ConflictRefreshTarget | null>(null);
  const bookingStateRef = useRef(bookingState);
  const createRequestIdRef = useRef(0);
  const createFocusGenerationRef = useRef(0);
  const createdBookingFocusRef = useRef<CreatedBookingFocusTarget | null>(null);
  const linkedBookingIdRef = useRef(linkedBookingId);
  const cancellationRequestIdRef = useRef(0);
  const activeCancellationRequestIdRef = useRef<number | null>(null);

  const invalidateCreatedBookingFocus = useCallback(() => {
    createFocusGenerationRef.current += 1;
    createdBookingFocusRef.current = null;
  }, []);

  function invalidateCancellationRequest() {
    cancellationRequestIdRef.current += 1;
    activeCancellationRequestIdRef.current = null;
  }

  const handleAuthRequired = useCallback((code: string | undefined) => {
    if (!announceAuthRequired(code)) return false;
    roomsRequestSequence.current += 1;
    scheduleRequestSequence.current += 1;
    conflictRefreshGenerationRef.current += 1;
    conflictRefreshRequestRef.current = false;
    conflictRefreshTargetRef.current = null;
    preserveScheduleOnRefreshRef.current = false;
    invalidateCreatedBookingFocus();
    invalidateCancellationRequest();
    setRooms([]);
    setRoomsError('');
    setScheduleState(null);
    setPreservedScheduleKey(null);
    setSelectedRoomId('');
    setCancellation(null);
    dispatchBooking({type: 'NAVIGATE_ROOM_WEEK_DAY'});
    request({type: 'ROUTE_NAVIGATION'});
    return true;
  }, [invalidateCreatedBookingFocus, request]);

  const updateUrl = useCallback((
    roomId: string,
    nextWeekStart: string,
    nextDay: string,
    history: 'push' | 'replace',
  ) => {
    const parameters = new URLSearchParams();
    if (roomId) {
      parameters.set('roomId', roomId);
    }
    parameters.set('weekStart', nextWeekStart);
    parameters.set('day', nextDay);
    if (linkedBookingIdRef.current) {
      parameters.set('bookingId', linkedBookingIdRef.current);
    }
    const url = `/schedule?${parameters.toString()}`;
    if (history === 'push') {
      router.push(url, {scroll: false});
    } else {
      router.replace(url, {scroll: false});
    }
  }, [router]);

  useEffect(() => {
    linkedBookingIdRef.current = linkedBookingId;
  }, [linkedBookingId]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
    weekStartRef.current = weekStart;
    selectedDayRef.current = selectedDay;
  }, [selectedDay, selectedRoomId, weekStart]);

  useEffect(() => {
    bookingStateRef.current = bookingState;
  }, [bookingState]);

  useEffect(() => {
    if (
      bookingState.status !== 'closed' ||
      !restoreBookingDetailsFocusRef.current
    ) {
      return;
    }
    restoreBookingDetailsFocusRef.current = false;
    const invoker = bookingDetailsInvokerRef.current;
    bookingDetailsInvokerRef.current = null;
    if (invoker?.isConnected) {
      invoker.focus();
    }
  }, [bookingState.status]);

  useEffect(() => {
    if (positionedDayRef.current === selectedDay) return;
    positionedDayRef.current = selectedDay;
    setPositionEpoch((epoch) => epoch + 1);
  }, [selectedDay]);

  useEffect(() => {
    const nextWeekStart = normalizeWeekStart(
      searchParams.get('weekStart'),
      officeTimeZone,
    );
    const nextDay = normalizeDay(
      searchParams.get('day'),
      nextWeekStart,
      officeTimeZone,
    );
    const nextRoomId = searchParams.get('roomId');
    const roomChanged = Boolean(
      nextRoomId && nextRoomId !== selectedRoomIdRef.current,
    );
    const weekChanged = nextWeekStart !== weekStartRef.current;
    const dayChanged = nextDay !== selectedDayRef.current;

    if (roomChanged && nextRoomId) {
      setSelectedRoomId(nextRoomId);
    }
    if (weekChanged) {
      setWeekStart(nextWeekStart);
    }
    if (dayChanged) {
      setSelectedDay(nextDay);
    }
    if (roomChanged || weekChanged) {
      preserveScheduleOnRefreshRef.current = false;
      conflictRefreshRequestRef.current = false;
      conflictRefreshTargetRef.current = null;
      setPreservedScheduleKey(null);
      scheduleRequestSequence.current += 1;
      setScheduleState(null);
    }
    if (roomChanged || weekChanged || dayChanged) {
      invalidateCreatedBookingFocus();
      invalidateCancellationRequest();
      setCancellation(null);
      request({type: 'ROUTE_NAVIGATION'});
      dispatchBooking({type: 'NAVIGATE_ROOM_WEEK_DAY'});
    }
  }, [
    invalidateCreatedBookingFocus,
    officeTimeZone,
    request,
    searchParams,
  ]);

  useEffect(() => () => {
    invalidateCancellationRequest();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRooms() {
      setRoomsLoading(true);
      setRoomsError('');
      try {
        const parameters = new URLSearchParams();
        if (appliedMinCapacity) {
          parameters.set('minCapacity', appliedMinCapacity);
        }
        const suffix = parameters.size > 0 ? `?${parameters.toString()}` : '';
        const requestSequence = ++roomsRequestSequence.current;
        const response = await fetch(`/api/rooms${suffix}`, {
          signal: controller.signal,
        });
        const body = await response.json() as ApiResponse<RoomSummary[]>;
        if (handleAuthRequired(body.error?.code)) return;
        if (!response.ok || !body.data) {
          throw new LocalizedRequestError(localizeApiError({
            code: body.error?.code,
            fallback: 'rooms',
          }));
        }
        if (
          controller.signal.aborted ||
          requestSequence !== roomsRequestSequence.current
        ) {
          return;
        }
        setRooms(body.data);
        const currentRoomId = selectedRoomIdRef.current;
        const roomId = body.data.some((room) => room.id === currentRoomId) ?
          currentRoomId :
          body.data[0]?.id ?? '';
        setSelectedRoomId(roomId);
        if (roomId !== currentRoomId) {
          setPositionEpoch((epoch) => epoch + 1);
          preserveScheduleOnRefreshRef.current = false;
          conflictRefreshRequestRef.current = false;
          conflictRefreshTargetRef.current = null;
          setPreservedScheduleKey(null);
          scheduleRequestSequence.current += 1;
          setScheduleState(null);
          invalidateCreatedBookingFocus();
          dispatchBooking({type: 'NAVIGATE_ROOM_WEEK_DAY'});
        }
        updateUrl(
          roomId,
          weekStartRef.current,
          selectedDayRef.current,
          'replace',
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setRooms([]);
        setRoomsError(
          error instanceof LocalizedRequestError ?
            error.message :
            localizeApiError({code: 'UNKNOWN_TRANSPORT', fallback: 'rooms'}),
        );
      } finally {
        if (!controller.signal.aborted) {
          setRoomsLoading(false);
        }
      }
    }
    void loadRooms();
    return () => controller.abort();
  }, [
    appliedMinCapacity,
    handleAuthRequired,
    invalidateCreatedBookingFocus,
    roomsRetryKey,
    updateUrl,
  ]);

  const activeScheduleKey = selectedRoomId ?
    `${selectedRoomId}:${weekStart}:${refreshKey}` :
    '';

  const buildOptionsForSchedule = useCallback((scheduleData: ScheduleData) => {
    const state = bookingStateRef.current;
    if (!('selection' in state)) return [];
    return buildBookingEndTimeOptions({
      bookings: scheduleData.bookings,
      officeCloseHour,
      officeTimeZone: scheduleData.officeTimeZone,
      startsAt: state.selection.startsAt,
      userTimeZone,
    });
  }, [officeCloseHour, userTimeZone]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    const controller = new AbortController();
    const requestSequence = ++scheduleRequestSequence.current;
    const requestKey = activeScheduleKey;
    const preserveSchedule = preserveScheduleOnRefreshRef.current;
    const conflictRefreshRequest = conflictRefreshRequestRef.current;
    const conflictRefreshGeneration = conflictRefreshGenerationRef.current;
    function isActiveConflictRefreshRequest(): boolean {
      return (
        conflictRefreshRequest &&
        conflictRefreshRequestRef.current &&
        conflictRefreshGeneration === conflictRefreshGenerationRef.current
      );
    }
    async function loadSchedule() {
      if (!preserveSchedule) {
        setScheduleState({key: requestKey, status: 'loading'});
      }
      try {
        const response = await fetch(
          `/api/rooms/${selectedRoomId}/schedule?weekStart=${weekStart}`,
          {signal: controller.signal},
        );
        const body = await response.json() as ApiResponse<ScheduleData>;
        if (
          controller.signal.aborted ||
          requestSequence !== scheduleRequestSequence.current
        ) {
          return;
        }
        if (handleAuthRequired(body.error?.code)) return;
        if (!response.ok || !body.data) {
          throw new LocalizedRequestError(localizeApiError({
            code: body.error?.code,
            fallback: 'schedule',
          }));
        }
        if (isActiveConflictRefreshRequest()) {
          conflictRefreshRequestRef.current = false;
          preserveScheduleOnRefreshRef.current = false;
          setPreservedScheduleKey(null);
          applyConflictRefreshSuccess({
            conflictGeneration: conflictRefreshGeneration,
            schedule: body.data,
          }, {
            activeConflictGeneration: conflictRefreshGenerationRef.current,
            buildOptions: buildOptionsForSchedule,
            commitSchedule: (data) => setScheduleState({
              data,
              key: requestKey,
              status: 'success',
            }),
            dispatch: dispatchBooking,
          });
          return;
        }
        preserveScheduleOnRefreshRef.current = false;
        setPreservedScheduleKey(null);
        setScheduleState({
          data: body.data,
          key: requestKey,
          status: 'success',
        });
      } catch (error) {
        if (
          controller.signal.aborted ||
          requestSequence !== scheduleRequestSequence.current ||
          (error instanceof DOMException && error.name === 'AbortError')
        ) {
          return;
        }
        preserveScheduleOnRefreshRef.current = false;
        if (conflictRefreshRequest) {
          if (isActiveConflictRefreshRequest()) {
            conflictRefreshRequestRef.current = false;
            dispatchBooking({
              conflictGeneration: conflictRefreshGeneration,
              type: 'REFRESH_ERROR',
            });
          }
          return;
        }
        setPreservedScheduleKey(null);
        setScheduleState({
          error: error instanceof LocalizedRequestError ?
            error.message :
            localizeApiError({
              code: 'UNKNOWN_TRANSPORT',
              fallback: 'schedule',
            }),
          key: requestKey,
          status: 'error',
        });
      }
    }
    void loadSchedule();
    return () => controller.abort();
  }, [
    activeScheduleKey,
    buildOptionsForSchedule,
    handleAuthRequired,
    selectedRoomId,
    weekStart,
  ]);

  useEffect(() => {
    if (scheduleState?.status === 'success' && !hasSettledInitialLoad.current) {
      hasSettledInitialLoad.current = true;
      setPositionEpoch((epoch) => epoch + 1);
    }
  }, [scheduleState]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setToastMessage(''), 4_000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const isCurrentSchedule = scheduleState?.key === activeScheduleKey;
  const isPreservedSchedule =
    scheduleState?.key === preservedScheduleKey &&
    scheduleState.status === 'success';
  const schedule =
    (isCurrentSchedule || isPreservedSchedule) &&
    scheduleState.status === 'success' ?
      scheduleState.data :
      null;
  const scheduleError =
    isCurrentSchedule && scheduleState.status === 'error' ?
      scheduleState.error :
      '';
  const scheduleLoading = Boolean(
    selectedRoomId &&
    (
      bookingState.status === 'conflictRefreshing' ||
      (
        !isCurrentSchedule &&
        !isPreservedSchedule
      ) ||
      scheduleState?.status === 'loading'
    ),
  );
  const activeStartSelection = 'selection' in bookingState ?
    bookingState.selection : null;
  const slotSelectionDisabled = bookingState.status === 'submitting' ||
    bookingState.status === 'conflictRefreshing';

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ??
      schedule?.room ??
      null,
    [rooms, schedule, selectedRoomId],
  );
  const selectedDayHasBookings = schedule?.bookings.some((booking) =>
    DateTime.fromISO(booking.startsAt)
      .setZone(schedule.officeTimeZone)
      .toFormat('yyyy-LL-dd') === selectedDay,
  ) ?? false;
  const mode = useResponsiveMode();
  const isCompactMode = mode === 'tablet' || mode === 'mobile';
  const isBookingSurfaceOpen = 'selection' in bookingState ||
    bookingState.status === 'details';
  const mediumBookingPaneOpen = mode === 'medium' && isBookingSurfaceOpen;
  const isRoomFilterVisible = isCompactMode && isRoomFilterOpen &&
    modalOwner === 'filter';

  useLayoutEffect(() => {
    const target = createdBookingFocusRef.current;
    if (
      !target ||
      target.focusGeneration !== createFocusGenerationRef.current ||
      target.requestId !== createRequestIdRef.current ||
      target.roomId !== selectedRoomId ||
      target.weekStart !== weekStart ||
      scheduleState?.status !== 'success' ||
      scheduleState.key !== target.scheduleKey
    ) {
      return;
    }

    const bookingRoot = Array.from(
      document.querySelectorAll<HTMLElement>('[data-booking-id]'),
    ).find((element) => element.dataset.bookingId === target.bookingId);
    const bookingTarget = bookingRoot?.matches('button') ?
      bookingRoot :
      bookingRoot?.querySelector<HTMLElement>('.day-agenda-details');
    const dayHeading =
      document.getElementById(`day-${target.officeDay}`) ??
      document.getElementById(`day-agenda-${target.officeDay}`);
    (bookingTarget ?? dayHeading)?.focus();
    createdBookingFocusRef.current = null;
  }, [scheduleState, selectedRoomId, weekStart]);

  useEffect(() => {
    if (roomsLoading || !restoreRoomRetryFocusRef.current) return;
    const target = roomsError ?
      roomRetryButtonRef.current :
      isCompactMode ?
        roomFilterTriggerRef.current :
        roomPickerRef.current;
    target?.focus();
    restoreRoomRetryFocusRef.current = false;
  }, [isCompactMode, roomsError, roomsLoading]);

  useEffect(() => {
    function reconcileFilterForViewport() {
      const nextMode = getResponsiveMode(window.innerWidth);
      if (
        nextMode === 'mobile' ||
        nextMode === 'tablet' ||
        !isRoomFilterOpen ||
        modalOwner !== 'filter'
      ) {
        return;
      }
      setDraftMinCapacity(appliedMinCapacity);
      setIsRoomFilterOpen(false);
      request({type: 'CLOSE_FILTER'});
    }

    window.addEventListener('resize', reconcileFilterForViewport);
    return () => window.removeEventListener('resize', reconcileFilterForViewport);
  }, [
    appliedMinCapacity,
    isRoomFilterOpen,
    modalOwner,
    request,
  ]);

  useEffect(() => {
    if (isCompactMode && isBookingSurfaceOpen && modalOwner === 'none') {
      request({type: 'OPEN_BOOKING'});
    } else if (
      modalOwner === 'booking' &&
      (!isCompactMode || !isBookingSurfaceOpen)
    ) {
      request({type: 'CLOSE_BOOKING'});
    }
  }, [isBookingSurfaceOpen, isCompactMode, modalOwner, request]);

  const closeRoomFilter = useCallback(() => {
    if (request({type: 'CLOSE_FILTER'}) === 'ACCEPTED') {
      setDraftMinCapacity(appliedMinCapacity);
      setIsRoomFilterOpen(false);
    }
  }, [appliedMinCapacity, request]);

  function changeMinimumCapacity(value: string) {
    setDraftMinCapacity(value);
    if (!isCompactMode) {
      setAppliedMinCapacity(value);
    }
  }

  function applyRoomFilter() {
    if (request({type: 'APPLY_FILTER'}) !== 'ACCEPTED') return;
    setAppliedMinCapacity(draftMinCapacity);
    setIsRoomFilterOpen(false);
  }

  function changeRoom(roomId: string) {
    if (roomId === selectedRoomId) return;
    setPositionEpoch((epoch) => epoch + 1);
    linkedBookingIdRef.current = null;
    preserveScheduleOnRefreshRef.current = false;
    conflictRefreshRequestRef.current = false;
    conflictRefreshTargetRef.current = null;
    setPreservedScheduleKey(null);
    setCancellation(null);
    setAgendaJumpStartsAt(null);
    invalidateCreatedBookingFocus();
    dispatchBooking({type: 'NAVIGATE_ROOM_WEEK_DAY'});
    setSelectedRoomId(roomId);
    updateUrl(roomId, weekStart, selectedDay, 'push');
  }

  function changeWeek(weeks: number) {
    linkedBookingIdRef.current = null;
    const nextWeek = DateTime.fromISO(weekStart, {zone: officeTimeZone})
      .plus({weeks})
      .toFormat('yyyy-LL-dd');
    const nextDay = DateTime.fromISO(selectedDay, {zone: officeTimeZone})
      .plus({weeks})
      .toFormat('yyyy-LL-dd');
    preserveScheduleOnRefreshRef.current = false;
    conflictRefreshRequestRef.current = false;
    conflictRefreshTargetRef.current = null;
    setPreservedScheduleKey(null);
    setCancellation(null);
    setAgendaJumpStartsAt(null);
    invalidateCreatedBookingFocus();
    dispatchBooking({type: 'NAVIGATE_ROOM_WEEK_DAY'});
    setWeekStart(nextWeek);
    setSelectedDay(nextDay);
    updateUrl(selectedRoomId, nextWeek, nextDay, 'push');
  }

  function changeDay(value: string) {
    const nextDayValue = DateTime.fromISO(value, {zone: officeTimeZone});
    if (!nextDayValue.isValid) {
      return;
    }
    linkedBookingIdRef.current = null;
    const nextDay = nextDayValue.toFormat('yyyy-LL-dd');
    if (nextDay === selectedDay) return;
    const nextWeek = nextDayValue.startOf('week').toFormat('yyyy-LL-dd');
    if (nextWeek !== weekStart) {
      conflictRefreshRequestRef.current = false;
      conflictRefreshTargetRef.current = null;
      setPreservedScheduleKey(null);
    }
    preserveScheduleOnRefreshRef.current = false;
    setCancellation(null);
    setAgendaJumpStartsAt(null);
    invalidateCreatedBookingFocus();
    dispatchBooking({type: 'NAVIGATE_ROOM_WEEK_DAY'});
    setWeekStart(nextWeek);
    setSelectedDay(nextDay);
    updateUrl(selectedRoomId, nextWeek, nextDay, 'push');
  }

  function moveDay(days: number) {
    const nextDay = DateTime.fromISO(selectedDay, {zone: officeTimeZone})
      .plus({days})
      .toFormat('yyyy-LL-dd');
    changeDay(nextDay);
  }

  function goToToday() {
    linkedBookingIdRef.current = null;
    const today = DateTime.now()
      .setZone(officeTimeZone)
      .toFormat('yyyy-LL-dd');
    const currentWeek = currentOfficeWeek(officeTimeZone);
    preserveScheduleOnRefreshRef.current = false;
    conflictRefreshRequestRef.current = false;
    conflictRefreshTargetRef.current = null;
    if (currentWeek !== weekStart) {
      setPreservedScheduleKey(null);
    }
    setCancellation(null);
    setAgendaJumpStartsAt(null);
    invalidateCreatedBookingFocus();
    dispatchBooking({type: 'NAVIGATE_ROOM_WEEK_DAY'});
    setWeekStart(currentWeek);
    setSelectedDay(today);
    updateUrl(selectedRoomId, currentWeek, today, 'push');
  }

  function handleCancelled() {
    conflictRefreshGenerationRef.current += 1;
    conflictRefreshRequestRef.current = false;
    conflictRefreshTargetRef.current = null;
    preserveScheduleOnRefreshRef.current = true;
    if (scheduleState?.status === 'success') {
      setPreservedScheduleKey(scheduleState.key);
    }
    setCancellation(null);
    dispatchBooking({type: 'CLOSE'});
    setToastMessage(uiCopy.bookingCancelled);
    setRefreshKey((key) => key + 1);
  }

  function closeCancellation(command: 'KEEP_CANCEL' | 'CANCEL_ERROR_CLOSE') {
    if (cancellation?.pending) return;
    if (request({
      bookingRestore: {
        cancelTrigger: bookingDetailsCancelButtonRef.current,
        modal: isCompactMode,
      },
      type: command,
    }) === 'ACCEPTED') {
      setCancellation(null);
    }
  }

  function confirmCancellation() {
    if (!cancellation || activeCancellationRequestIdRef.current !== null) return;
    const requestId = ++cancellationRequestIdRef.current;
    const bookingId = cancellation.booking.id;
    activeCancellationRequestIdRef.current = requestId;
    setCancellation((current) => current?.booking.id === bookingId ? {
      ...current,
      error: '',
      pending: true,
    } : current);
    void (async () => {
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`, {
          method: 'DELETE',
        });
        if (activeCancellationRequestIdRef.current !== requestId) return;
        if (!response.ok) {
          let code: string | undefined;
          try {
            const body = await response.json() as ApiResponse<unknown>;
            code = body.error?.code;
          } catch {
            // The localized fallback covers malformed error responses.
          }
          if (handleAuthRequired(code)) return;
          setCancellation((current) => current?.booking.id === bookingId ? {
            ...current,
            error: localizeApiError({code, fallback: 'cancellation'}),
            pending: false,
          } : current);
          return;
        }
        activeCancellationRequestIdRef.current = null;
        request({type: 'CANCEL_SUCCESS'});
        handleCancelled();
      } catch {
        if (activeCancellationRequestIdRef.current !== requestId) return;
        setCancellation((current) => current?.booking.id === bookingId ? {
          ...current,
          error: localizeApiError({
            code: 'UNKNOWN_TRANSPORT',
            fallback: 'cancellation',
          }),
          pending: false,
        } : current);
      } finally {
        if (activeCancellationRequestIdRef.current === requestId) {
          activeCancellationRequestIdRef.current = null;
        }
      }
    })();
  }

  function closeBookingSurface() {
    conflictRefreshGenerationRef.current += 1;
    conflictRefreshRequestRef.current = false;
    conflictRefreshTargetRef.current = null;
    invalidateCreatedBookingFocus();
    if (!isCompactMode && bookingStateRef.current.status === 'details') {
      restoreBookingDetailsFocusRef.current = true;
    }
    if (isCompactMode) request({type: 'CLOSE_BOOKING'});
    dispatchBooking({type: 'CLOSE'});
  }

  function refreshAfterConflict(target: ConflictRefreshTarget) {
    if (
      scheduleState?.status === 'success' &&
      target.roomId === selectedRoomIdRef.current &&
      target.weekStart === weekStartRef.current
    ) {
      setPreservedScheduleKey(scheduleState.key);
    }
    preserveScheduleOnRefreshRef.current = true;
    conflictRefreshGenerationRef.current = target.conflictGeneration;
    conflictRefreshRequestRef.current = true;
    conflictRefreshTargetRef.current = target;
    void (async () => {
      try {
        const response = await fetch(
          `/api/rooms/${target.roomId}/schedule?weekStart=${target.weekStart}`,
        );
        const body = await response.json() as ApiResponse<ScheduleData>;
        if (conflictRefreshTargetRef.current !== target) return;
        if (handleAuthRequired(body.error?.code)) return;
        conflictRefreshRequestRef.current = false;
        if (!response.ok || !body.data) {
          dispatchBooking({
            conflictGeneration: target.conflictGeneration,
            type: 'REFRESH_ERROR',
          });
          return;
        }
        if (
          target.roomId !== selectedRoomIdRef.current ||
          target.weekStart !== weekStartRef.current
        ) {
          return;
        }
        applyConflictRefreshSuccess({
          conflictGeneration: target.conflictGeneration,
          schedule: body.data,
        }, {
          activeConflictGeneration: conflictRefreshGenerationRef.current,
          buildOptions: buildOptionsForSchedule,
          commitSchedule: (data) => setScheduleState({
            data,
            key: activeScheduleKey,
            status: 'success',
          }),
          dispatch: dispatchBooking,
        });
      } catch {
        if (conflictRefreshTargetRef.current !== target) return;
        conflictRefreshRequestRef.current = false;
        dispatchBooking({
          conflictGeneration: target.conflictGeneration,
          type: 'REFRESH_ERROR',
        });
      }
    })();
  }

  function selectStartSlot(selection: StartSlotSelection) {
    const state = bookingStateRef.current;
    if (
      'selection' in state &&
      (state.status === 'submitting' || state.status === 'conflictRefreshing')
    ) {
      return;
    }
    if (!schedule) return;
    if (isCompactMode && request({type: 'OPEN_BOOKING'}) === 'DENIED') return;
    invalidateCreatedBookingFocus();
    dispatchBooking({
      options: buildBookingEndTimeOptions({
        bookings: schedule.bookings,
        officeCloseHour,
        officeTimeZone: schedule.officeTimeZone,
        startsAt: selection.startsAt,
        userTimeZone,
      }),
      selection,
      type: 'SELECT_SLOT',
    });
  }

  function submitBooking() {
    const state = bookingStateRef.current;
    if (!('selection' in state) || state.status !== 'editing') return;
    const title = state.title.trim();
    if (!title) {
      dispatchBooking({
        fields: {title: uiFieldMessage.title},
        type: 'VALIDATION_ERROR',
      });
      return;
    }
    if (!state.endOptions.some((option) => option.endsAt === state.endsAt)) {
      dispatchBooking({
        fields: {endsAt: uiFieldMessage.endsAt},
        type: 'VALIDATION_ERROR',
      });
      return;
    }
    const requestId = ++createRequestIdRef.current;
    const focusGeneration = createFocusGenerationRef.current + 1;
    createFocusGenerationRef.current = focusGeneration;
    createdBookingFocusRef.current = null;
    const conflictTarget: ConflictRefreshTarget = {
      conflictGeneration: state.conflictGeneration + 1,
      requestId,
      roomId: state.selection.roomId,
      weekStart,
    };
    const capturedRoomId = state.selection.roomId;
    const capturedWeekStart = weekStart;
    dispatchBooking({requestId, type: 'SUBMIT'});
    void (async () => {
      try {
        const response = await fetch('/api/bookings', {
          body: JSON.stringify({
            endsAt: state.endsAt,
            roomId: state.selection.roomId,
            startsAt: state.selection.startsAt,
            title,
          }),
          headers: {'content-type': 'application/json'},
          method: 'POST',
        });
        const body = await response.json() as ApiResponse<ScheduleBooking>;
        if (handleAuthRequired(body.error?.code)) return;
        if (!response.ok) {
          const code = body.error?.code;
          if (code === 'BOOKING_CONFLICT') {
            const activeRequest =
              bookingStateRef.current.status === 'submitting' &&
              bookingStateRef.current.createRequestId === requestId;
            dispatchBooking({
              code,
              fields: {},
              requestId,
              type: 'CREATE_DOMAIN_ERROR',
            });
            if (activeRequest) {
              refreshAfterConflict(conflictTarget);
            } else {
              void revalidateCapturedSchedule(
                conflictTarget.roomId,
                conflictTarget.weekStart,
              );
            }
            return;
          }
          dispatchBooking({
            code: code === 'EMAIL_NOT_VERIFIED' ? code : 'VALIDATION_FAILED',
            fields: body.error?.fields ?? {},
            requestId,
            type: 'CREATE_DOMAIN_ERROR',
          });
          return;
        }
        const createdBooking = body.data ?? {
            author: {id: '', name: ''},
            endsAt: state.endsAt,
            id: '',
            isOwn: true,
            startsAt: state.selection.startsAt,
            title,
        };
        dispatchBooking({
          booking: createdBooking,
          requestId,
          type: 'CREATE_OK',
        });
        if (
          focusGeneration === createFocusGenerationRef.current &&
          requestId === createRequestIdRef.current &&
          bookingStateRef.current.status === 'submitting' &&
          bookingStateRef.current.createRequestId === requestId &&
          capturedRoomId === selectedRoomIdRef.current &&
          capturedWeekStart === weekStartRef.current
        ) {
          const nextRefreshKey = refreshKey + 1;
          createdBookingFocusRef.current = {
            bookingId: createdBooking.id,
            focusGeneration,
            officeDay: DateTime.fromISO(createdBooking.startsAt, {setZone: true})
              .setZone(schedule?.officeTimeZone ?? officeTimeZone)
              .toFormat('yyyy-LL-dd'),
            requestId,
            roomId: capturedRoomId,
            scheduleKey:
              `${capturedRoomId}:${capturedWeekStart}:${nextRefreshKey}`,
            weekStart: capturedWeekStart,
          };
          preserveScheduleOnRefreshRef.current = false;
          setPreservedScheduleKey(null);
          setToastMessage(uiCopy.bookingCreated);
          setRefreshKey(nextRefreshKey);
        } else {
          void revalidateCapturedSchedule(capturedRoomId, capturedWeekStart);
        }
      } catch {
        dispatchBooking({requestId, type: 'CREATE_TRANSPORT_ERROR'});
      }
    })();
  }

  async function revalidateCapturedSchedule(roomId: string, capturedWeekStart: string) {
    try {
      const response = await fetch(
        `/api/rooms/${roomId}/schedule?weekStart=${capturedWeekStart}`,
      );
      const body = await response.json() as ApiResponse<ScheduleData>;
      if (handleAuthRequired(body.error?.code)) return;
      if (
        !response.ok || !body.data || roomId !== selectedRoomIdRef.current ||
        capturedWeekStart !== weekStartRef.current
      ) {
        return;
      }
      setScheduleState({
        data: body.data,
        key: activeScheduleKey,
        status: 'success',
      });
    } catch {
      // A stale create must not replace the current schedule error state.
    }
  }

  function retryConflictRefresh() {
    const state = bookingStateRef.current;
    if (!('selection' in state) || state.status !== 'conflictError') return;
    const conflictTarget: ConflictRefreshTarget = {
      conflictGeneration: state.conflictGeneration + 1,
      requestId: state.createRequestId ?? 0,
      roomId: state.selection.roomId,
      weekStart,
    };
    dispatchBooking({type: 'RETRY_REFRESH'});
    refreshAfterConflict(conflictTarget);
  }

  function openBookingDetails(
    booking: ScheduleBooking,
    invoker: HTMLElement,
  ) {
    if (isCompactMode && request({type: 'OPEN_BOOKING'}) === 'DENIED') return;
    bookingDetailsInvokerRef.current = invoker;
    linkedBookingIdRef.current = booking.id;
    updateUrl(selectedRoomId, weekStart, selectedDay, 'replace');
    dispatchBooking({booking, type: 'OPEN_DETAILS'});
  }

  function openDirectCancellation(
    booking: ScheduleBooking,
    invoker: HTMLElement,
  ) {
    if (request({
      origin: {invoker, kind: 'schedule'},
      type: 'OPEN_CANCEL_DIRECT',
    }) !== 'ACCEPTED') return;
    setCancellation({
      booking: {id: booking.id, title: booking.title},
      error: '',
      pending: false,
    });
  }

  function openDetailsCancellation(
    booking: ScheduleBooking,
    trigger: HTMLElement,
  ) {
    if (request({
      trigger,
      type: 'OPEN_CANCEL_FROM_BOOKING',
    }) !== 'ACCEPTED') return;
    setCancellation({
      booking: {id: booking.id, title: booking.title},
      error: '',
      pending: false,
    });
  }

  function jumpTo(target: ScheduleJumpTarget) {
    if (target.officeDay !== selectedDay) {
      changeDay(target.officeDay);
    } else {
      setPositionEpoch((epoch) => epoch + 1);
    }
    setAgendaJumpStartsAt(target.startsAt);
  }

  return (
    <section
      aria-label={uiCopy.roomSchedule}
      className="schedule-workspace"
      data-booking-open={isBookingSurfaceOpen ? 'true' : 'false'}
      data-medium-pane={
        mode === 'medium' ? mediumBookingPaneOpen ? 'booking' : 'room' : undefined
      }
    >
      <a
        className="skip-link schedule-jump-link"
        href="#schedule-jump-day"
        onClick={(event) => {
          const target = document.getElementById('schedule-jump-day');
          if (target instanceof HTMLElement) {
            event.preventDefault();
            target.focus();
          }
        }}
      >
        {uiCopy.skipToTimeSearch}
      </a>
      <div
        className="schedule-workspace-content"
      >
        <div className="schedule-workspace-layout">
        {mode === 'expanded' || mode === 'medium' ? (
          <aside
            aria-label={uiCopy.roomPicker}
            className="schedule-room-rail"
            hidden={mediumBookingPaneOpen}
            inert={mediumBookingPaneOpen || undefined}
          >
            <RoomPicker
              onRoomChange={changeRoom}
              rooms={rooms}
              selectRef={roomPickerRef}
              selectedRoomId={selectedRoomId}
            />
            <label className="control-field capacity-field">
              <span>{uiCopy.minimumCapacity}</span>
              <input
                min="0"
                onChange={(event) =>
                  changeMinimumCapacity(event.target.value)}
                placeholder={uiCopy.any}
                step="1"
                type="number"
                value={draftMinCapacity}
              />
            </label>
          </aside>
        ) : null}
        <div className="schedule-workspace-main">
          <div className="schedule-toolbar">
          <ScheduleNavigation
        mode={mode}
        onDayChange={changeDay}
        onJump={jumpTo}
        onNextDay={() => moveDay(1)}
        onNextWeek={() => changeWeek(1)}
        onPreviousDay={() => moveDay(-1)}
        onPreviousWeek={() => changeWeek(-1)}
        onToday={goToToday}
        officeCloseHour={officeCloseHour}
        officeOpenHour={officeOpenHour}
        officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
        selectedDay={selectedDay}
        userTimeZone={userTimeZone}
        weekStart={weekStart}
      />

          <div className="room-context">
        {selectedRoom ? (
          <div className="room-meta">
            <strong>{selectedRoom.name}</strong>
            <span>
              <Building2 aria-hidden="true" />
              {uiCopy.floor} {selectedRoom.floor}
            </span>
            <span>
              <UsersRound aria-hidden="true" />
              {selectedRoom.capacity} {uiCopy.places}
            </span>
          </div>
        ) : (
          <span className="room-meta-placeholder">{uiCopy.selectRoom}</span>
        )}
        {isCompactMode ? (
          <button
            aria-label={uiCopy.openRoomFilters}
            className="room-filter-trigger icon-button"
            onClick={(event) => {
              if (request({
                trigger: event.currentTarget,
                type: 'OPEN_FILTER',
              }) === 'ACCEPTED') {
                setDraftMinCapacity(appliedMinCapacity);
                setIsRoomFilterOpen(true);
              }
            }}
            ref={roomFilterTriggerRef}
            title={uiCopy.openRoomFilters}
            type="button"
          >
            <SlidersHorizontal aria-hidden="true" />
          </button>
        ) : null}
        <TimezoneLabel
          officeCloseHour={officeCloseHour}
          officeOpenHour={officeOpenHour}
          officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
          userTimeZone={userTimeZone}
        />
      </div>
          </div>

      {roomsError ? (
        <div aria-live="assertive" className="schedule-message" role="alert">
          <strong>{uiCopy.roomsUnavailable}</strong>
          <span>{roomsError}</span>
          <button
            className="secondary-button"
            onClick={() => {
              restoreRoomRetryFocusRef.current = true;
              setRoomsRetryKey((key) => key + 1);
            }}
            ref={roomRetryButtonRef}
            type="button"
          >
            {uiCopy.retryRooms}
          </button>
        </div>
      ) : null}
      {roomsLoading && !scheduleLoading && schedule ? (
        <Spinner label={uiCopy.loadingRooms} />
      ) : null}
      {!roomsLoading && !roomsError && rooms.length === 0 ? (
        <div className="schedule-message" role="status">
          <strong>{uiCopy.noRoomsMatchCapacity}</strong>
          <span>{uiCopy.lowerMinimumCapacity}</span>
        </div>
      ) : null}
      {scheduleError ? (
        <div aria-live="assertive" className="schedule-message" role="alert">
          <strong>{uiCopy.scheduleUnavailable}</strong>
          <span>{scheduleError}</span>
          <button
            className="secondary-button"
            onClick={() => setRefreshKey((key) => key + 1)}
            type="button"
          >
            {uiCopy.retrySchedule}
          </button>
        </div>
      ) : null}

          {selectedRoom ? (
        <div className="schedule-grid-shell">
          <a
            className="skip-link schedule-after-link"
            href="#schedule-after"
          >
            {uiCopy.skipSchedule}
          </a>
          <p
            aria-live="polite"
            className="empty-schedule-note"
            role="status"
          >
            {mode === 'expanded' || mode === 'medium' ?
              schedule?.bookings.length === 0 && !scheduleLoading ?
                uiCopy.noBookingsThisWeek :
                '' :
              !selectedDayHasBookings && !scheduleLoading ?
                uiCopy.noBookingsThisDay :
                ''}
          </p>
          <ScheduleViewport
            mode={mode}
            onVisibleTimeAnchorChange={setVisibleTimeAnchor}
            renderAgenda={(slotSelectionDisabled) => (
              <DayAgenda
                bookings={schedule?.bookings ?? []}
                highlightedBookingId={linkedBookingId}
                now={DateTime.now().toUTC().toISO() ?? ''}
                officeCloseHour={officeCloseHour}
                officeDay={selectedDay}
                officeOpenHour={officeOpenHour}
                officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
                onCancel={openDirectCancellation}
                onOpenDetails={openBookingDetails}
                onSelectSlot={selectStartSlot}
                positionEpoch={positionEpoch}
                room={selectedRoom}
                selectedStartsAt={agendaJumpStartsAt ?? activeStartSelection?.startsAt ?? null}
                slotSelectionDisabled={slotSelectionDisabled}
                userTimeZone={userTimeZone}
                weekStart={weekStart}
              />
            )}
            renderTimetable={(visibleDayCount, slotSelectionDisabled) => schedule ? (
              <Timetable
                bookings={schedule.bookings}
                highlightedBookingId={linkedBookingId}
                now={DateTime.now().toUTC().toISO() ?? ''}
                officeCloseHour={officeCloseHour}
                officeOpenHour={officeOpenHour}
                officeTimeZone={schedule.officeTimeZone}
                onOpenDetails={openBookingDetails}
                onSelectSlot={selectStartSlot}
                room={selectedRoom}
                slotSelectionDisabled={slotSelectionDisabled}
                userTimeZone={userTimeZone}
                visibleDays={visibleTimetableDays(
                  selectedDay,
                  visibleDayCount,
                  weekStart,
                  schedule.officeTimeZone,
                )}
                weekStart={weekStart}
              />
            ) : null}
            selectedDay={selectedDay}
            slotSelectionDisabled={slotSelectionDisabled}
            visibleTimeAnchor={visibleTimeAnchor}
          />
          {scheduleLoading ? (
            <div className="schedule-loading-overlay">
              <Spinner label={uiCopy.loadingSchedule} />
            </div>
          ) : null}
        </div>
      ) : null}

        </div>
      </div>
      </div>
      <AdaptiveBookingSurface
        detailsCancelButtonRef={bookingDetailsCancelButtonRef}
        detailsContext={{
          officeTimeZone: schedule?.officeTimeZone ?? officeTimeZone,
          roomName: selectedRoom?.name ?? '',
          userTimeZone,
        }}
        mode={mode}
        onCancelDetails={openDetailsCancellation}
        onClose={closeBookingSurface}
        onEndChange={(endsAt) => dispatchBooking({endsAt, type: 'END_CHANGED'})}
        onRetryRefresh={retryConflictRefresh}
        onSubmit={submitBooking}
        onTitleChange={(value) => dispatchBooking({
          type: 'TITLE_CHANGED',
          value,
        })}
        state={bookingState}
      />
      <span
        className="visually-hidden"
        id="schedule-after"
        tabIndex={-1}
      >
        {uiCopy.skipSchedule}
      </span>
      {cancellation && modalOwner === 'cancellation' ? (
        <CancellationDialog
          booking={cancellation.booking}
          error={cancellation.error}
          onCloseError={() => closeCancellation('CANCEL_ERROR_CLOSE')}
          onConfirm={confirmCancellation}
          onKeep={() => closeCancellation('KEEP_CANCEL')}
          pending={cancellation.pending}
        />
      ) : null}
      {toastMessage ? <Toast message={toastMessage} /> : null}
      <RoomFilterSurface
        isOpen={isRoomFilterVisible}
        minCapacity={draftMinCapacity}
        onApply={applyRoomFilter}
        onClose={closeRoomFilter}
        onMinCapacityChange={changeMinimumCapacity}
        onReset={() => setDraftMinCapacity('')}
        onRoomChange={(roomId) => {
          changeRoom(roomId);
          closeRoomFilter();
        }}
        rooms={rooms}
        selectedRoomId={selectedRoomId}
      />
    </section>
  );
}
