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
} from 'react';
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

const officeTimeZone = 'Europe/Kyiv';

function currentOfficeWeek(): string {
  return DateTime.now()
    .setZone(officeTimeZone)
    .startOf('week')
    .toFormat('yyyy-LL-dd');
}

function normalizeWeekStart(value: string | null): string {
  if (!value) {
    return currentOfficeWeek();
  }
  const parsed = DateTime.fromISO(value, {zone: officeTimeZone});
  return parsed.isValid && parsed.weekday === 1 ?
    parsed.toFormat('yyyy-LL-dd') :
    currentOfficeWeek();
}

export function ScheduleClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [minCapacity, setMinCapacity] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState(
    searchParams.get('roomId') ?? '',
  );
  const [weekStart, setWeekStart] = useState(
    normalizeWeekStart(searchParams.get('weekStart')),
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
  const scheduleRequestSequence = useRef(0);
  const preserveScheduleOnRefreshRef = useRef(false);
  const linkedBookingId = searchParams.get('bookingId');
  const linkedBookingIdRef = useRef(linkedBookingId);

  const updateUrl = useCallback((
    roomId: string,
    nextWeekStart: string,
  ) => {
    const parameters = new URLSearchParams();
    if (roomId) {
      parameters.set('roomId', roomId);
    }
    parameters.set('weekStart', nextWeekStart);
    if (linkedBookingIdRef.current) {
      parameters.set('bookingId', linkedBookingIdRef.current);
    }
    router.replace(`/schedule?${parameters.toString()}`, {scroll: false});
  }, [router]);

  useEffect(() => {
    linkedBookingIdRef.current = linkedBookingId;
  }, [linkedBookingId]);

  useEffect(() => {
    selectedRoomIdRef.current = selectedRoomId;
    weekStartRef.current = weekStart;
  }, [selectedRoomId, weekStart]);

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
        updateUrl(roomId, weekStartRef.current);
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

  function changeRoom(roomId: string) {
    linkedBookingIdRef.current = null;
    preserveScheduleOnRefreshRef.current = false;
    setPreservedScheduleKey(null);
    setCancellation(null);
    setSelection(null);
    setSelectedRoomId(roomId);
    updateUrl(roomId, weekStart);
  }

  function changeWeek(weeks: number) {
    linkedBookingIdRef.current = null;
    const nextWeek = DateTime.fromISO(weekStart, {zone: officeTimeZone})
      .plus({weeks})
      .toFormat('yyyy-LL-dd');
    preserveScheduleOnRefreshRef.current = false;
    setPreservedScheduleKey(null);
    setCancellation(null);
    setSelection(null);
    setWeekStart(nextWeek);
    updateUrl(selectedRoomId, nextWeek);
  }

  function goToToday() {
    linkedBookingIdRef.current = null;
    const currentWeek = currentOfficeWeek();
    preserveScheduleOnRefreshRef.current = false;
    setPreservedScheduleKey(null);
    setCancellation(null);
    setSelection(null);
    setWeekStart(currentWeek);
    updateUrl(selectedRoomId, currentWeek);
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
        onMinCapacityChange={setMinCapacity}
        onNextWeek={() => changeWeek(1)}
        onPreviousWeek={() => changeWeek(-1)}
        onRoomChange={changeRoom}
        onToday={goToToday}
        rooms={rooms}
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
          officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
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
            {schedule?.bookings.length === 0 && !scheduleLoading ?
              'No bookings this week' :
              ''}
          </p>
          <WeekGrid
            bookingEnabled={schedule !== null}
            bookings={schedule?.bookings ?? []}
            highlightedBookingId={linkedBookingId}
            loading={scheduleLoading || roomsLoading}
            officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
            onCancelBooking={setCancellation}
            onSelectSlot={setSelection}
            roomId={selectedRoom.id}
            roomName={selectedRoom.name}
            weekStart={weekStart}
          />
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
