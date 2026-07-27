'use client';

import {Building2, UsersRound} from 'lucide-react';
import {DateTime} from 'luxon';
import {useRouter, useSearchParams} from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {getBrowserTimeZone} from '../../lib/time/browser-zone';
import {
  CancelBookingDialog,
  type CancellationSelection,
} from '../bookings/cancel-booking-dialog';
import {Spinner} from '../ui/spinner';
import {Toast} from '../ui/toast';
import {
  BookingDialog,
  type BookingSelection,
} from './booking-dialog';
import {DaySchedule} from './day-schedule';
import {ScheduleToolbar} from './schedule-toolbar';
import {TimezoneLabel} from './timezone-label';
import {WeekGrid} from './week-grid';

type Room = {
  id: string;
  name: string;
  floor: number;
  capacity: number;
};

type Schedule = {
  room: Room;
  officeTimeZone: string;
  officeWeekStart: string;
  range: {startsAt: string; endsAt: string};
  bookings: Array<{
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    author: {id: string; name: string};
    isOwn: boolean;
  }>;
};

type ApiResponse<T> = {
  data?: T;
  error?: {message?: string};
};

type ScheduleLoadState =
  | {key: string; status: 'loading'}
  | {data: Schedule; key: string; status: 'success'}
  | {error: string; key: string; status: 'error'};

type ScheduleClientProps = {
  officeCloseHour: number;
  officeOpenHour: number;
  officeTimeZone: string;
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

function subscribeToBrowserTimeZone(): () => void {
  return () => undefined;
}

export function ScheduleClient({
  officeCloseHour,
  officeOpenHour,
  officeTimeZone,
}: ScheduleClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialWeekStart = normalizeWeekStart(
    searchParams.get('weekStart'),
    officeTimeZone,
  );
  const [minCapacity, setMinCapacity] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
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
  const [scheduleState, setScheduleState] =
    useState<ScheduleLoadState | null>(null);
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const [cancellation, setCancellation] =
    useState<CancellationSelection | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [preservedScheduleKey, setPreservedScheduleKey] =
    useState<string | null>(null);
  const selectedRoomIdRef = useRef(selectedRoomId);
  const weekStartRef = useRef(weekStart);
  const selectedDayRef = useRef(selectedDay);
  const scheduleRequestSequence = useRef(0);
  const preserveScheduleOnRefreshRef = useRef(false);
  const linkedBookingId = searchParams.get('bookingId');
  const linkedBookingIdRef = useRef(linkedBookingId);

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
      setPreservedScheduleKey(null);
      scheduleRequestSequence.current += 1;
      setScheduleState(null);
    }
    if (roomChanged || weekChanged || dayChanged) {
      setCancellation(null);
      setSelection(null);
    }
  }, [officeTimeZone, searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRooms() {
      setRoomsLoading(true);
      setRoomsError('');
      try {
        const parameters = new URLSearchParams();
        if (minCapacity) {
          parameters.set('minCapacity', minCapacity);
        }
        const suffix = parameters.size > 0 ? `?${parameters.toString()}` : '';
        const response = await fetch(`/api/rooms${suffix}`, {
          signal: controller.signal,
        });
        const body = await response.json() as ApiResponse<Room[]>;
        if (!response.ok || !body.data) {
          throw new Error(body.error?.message ?? 'Unable to load rooms.');
        }
        if (controller.signal.aborted) {
          return;
        }
        setRooms(body.data);
        const currentRoomId = selectedRoomIdRef.current;
        const roomId = body.data.some((room) => room.id === currentRoomId) ?
          currentRoomId :
          body.data[0]?.id ?? '';
        setSelectedRoomId(roomId);
        if (roomId !== currentRoomId) {
          preserveScheduleOnRefreshRef.current = false;
          setPreservedScheduleKey(null);
          scheduleRequestSequence.current += 1;
          setScheduleState(null);
          setSelection(null);
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
          error instanceof Error ? error.message : 'Unable to load rooms.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setRoomsLoading(false);
        }
      }
    }
    void loadRooms();
    return () => controller.abort();
  }, [minCapacity, updateUrl]);

  const activeScheduleKey = selectedRoomId ?
    `${selectedRoomId}:${weekStart}:${refreshKey}` :
    '';

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    const controller = new AbortController();
    const requestSequence = ++scheduleRequestSequence.current;
    const requestKey = activeScheduleKey;
    async function loadSchedule() {
      if (!preserveScheduleOnRefreshRef.current) {
        setScheduleState({key: requestKey, status: 'loading'});
      }
      try {
        const response = await fetch(
          `/api/rooms/${selectedRoomId}/schedule?weekStart=${weekStart}`,
          {signal: controller.signal},
        );
        const body = await response.json() as ApiResponse<Schedule>;
        if (
          controller.signal.aborted ||
          requestSequence !== scheduleRequestSequence.current
        ) {
          return;
        }
        if (!response.ok || !body.data) {
          throw new Error(
            body.error?.message ?? 'Unable to load the schedule.',
          );
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
        setPreservedScheduleKey(null);
        setScheduleState({
          error: error instanceof Error ?
            error.message :
            'Unable to load the schedule.',
          key: requestKey,
          status: 'error',
        });
      }
    }
    void loadSchedule();
    return () => controller.abort();
  }, [activeScheduleKey, selectedRoomId, weekStart]);

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
    (!isCurrentSchedule || scheduleState.status === 'loading'),
  );

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

  function changeRoom(roomId: string) {
    linkedBookingIdRef.current = null;
    preserveScheduleOnRefreshRef.current = false;
    setPreservedScheduleKey(null);
    setCancellation(null);
    setSelection(null);
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
    setPreservedScheduleKey(null);
    setCancellation(null);
    setSelection(null);
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
    const nextWeek = nextDayValue.startOf('week').toFormat('yyyy-LL-dd');
    preserveScheduleOnRefreshRef.current = false;
    setPreservedScheduleKey(null);
    setCancellation(null);
    setSelection(null);
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
    setPreservedScheduleKey(null);
    setCancellation(null);
    setSelection(null);
    setWeekStart(currentWeek);
    setSelectedDay(today);
    updateUrl(selectedRoomId, currentWeek, today, 'push');
  }

  function handleCreated() {
    preserveScheduleOnRefreshRef.current = false;
    setPreservedScheduleKey(null);
    setSelection(null);
    setToastMessage('Booking created');
    setRefreshKey((key) => key + 1);
  }

  function handleCancelled() {
    preserveScheduleOnRefreshRef.current = true;
    setPreservedScheduleKey(activeScheduleKey);
    setCancellation(null);
    setToastMessage('Booking cancelled');
    setRefreshKey((key) => key + 1);
  }

  return (
    <section aria-label="Room schedule" className="schedule-workspace">
      <ScheduleToolbar
        minCapacity={minCapacity}
        onDayChange={changeDay}
        onMinCapacityChange={setMinCapacity}
        onNextDay={() => moveDay(1)}
        onNextWeek={() => changeWeek(1)}
        onPreviousDay={() => moveDay(-1)}
        onPreviousWeek={() => changeWeek(-1)}
        onRoomChange={changeRoom}
        onToday={goToToday}
        rooms={rooms}
        selectedDay={selectedDay}
        selectedRoomId={selectedRoomId}
        weekStart={weekStart}
      />

      <div className="room-context">
        {selectedRoom ? (
          <div className="room-meta">
            <strong>{selectedRoom.name}</strong>
            <span>
              <Building2 aria-hidden="true" />
              Floor {selectedRoom.floor}
            </span>
            <span>
              <UsersRound aria-hidden="true" />
              {selectedRoom.capacity} people
            </span>
          </div>
        ) : (
          <span className="room-meta-placeholder">Select a room</span>
        )}
        <TimezoneLabel
          officeCloseHour={officeCloseHour}
          officeOpenHour={officeOpenHour}
          officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
          userTimeZone={userTimeZone}
        />
      </div>

      {roomsError ? (
        <div className="schedule-message" role="alert">
          <strong>Rooms unavailable</strong>
          <span>{roomsError}</span>
        </div>
      ) : null}
      {!roomsLoading && !roomsError && rooms.length === 0 ? (
        <div className="schedule-message" role="status">
          <strong>No rooms match this capacity</strong>
          <span>Lower the minimum capacity to see available rooms.</span>
        </div>
      ) : null}
      {scheduleError ? (
        <div className="schedule-message" role="alert">
          <strong>Schedule unavailable</strong>
          <span>{scheduleError}</span>
        </div>
      ) : null}

      {selectedRoom ? (
        <div className="schedule-grid-shell">
          <p className="empty-schedule-note">
            <span className="desktop-schedule">
              {schedule?.bookings.length === 0 && !scheduleLoading ?
                'No bookings this week' :
                ''}
            </span>
            <span className="mobile-schedule">
              {!selectedDayHasBookings && !scheduleLoading ?
                'No bookings this day' :
                ''}
            </span>
          </p>
          <div className="desktop-schedule">
            <WeekGrid
              bookingEnabled={schedule !== null}
              bookings={schedule?.bookings ?? []}
              highlightedBookingId={linkedBookingId}
              loading={scheduleLoading || roomsLoading}
              officeCloseHour={officeCloseHour}
              officeOpenHour={officeOpenHour}
              officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
              onCancelBooking={setCancellation}
              onSelectSlot={setSelection}
              roomId={selectedRoom.id}
              roomName={selectedRoom.name}
              userTimeZone={userTimeZone}
              weekStart={weekStart}
            />
          </div>
          <div className="mobile-schedule">
            <DaySchedule
              bookingEnabled={schedule !== null}
              bookings={schedule?.bookings ?? []}
              day={selectedDay}
              highlightedBookingId={linkedBookingId}
              loading={scheduleLoading || roomsLoading}
              officeCloseHour={officeCloseHour}
              officeOpenHour={officeOpenHour}
              officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
              onCancelBooking={setCancellation}
              onSelectSlot={setSelection}
              roomId={selectedRoom.id}
              roomName={selectedRoom.name}
              userTimeZone={userTimeZone}
            />
          </div>
          {scheduleLoading || roomsLoading ? (
            <div className="schedule-loading-overlay">
              <Spinner />
            </div>
          ) : null}
        </div>
      ) : null}

      <BookingDialog
        onClose={() => setSelection(null)}
        onCreated={handleCreated}
        selection={selection}
      />
      {cancellation ? (
        <CancelBookingDialog
          booking={cancellation}
          onCancelled={handleCancelled}
          onClose={() => setCancellation(null)}
        />
      ) : null}
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </section>
  );
}
