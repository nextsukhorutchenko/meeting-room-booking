'use client';

import {Building2, UsersRound} from 'lucide-react';
import {DateTime} from 'luxon';
import {useRouter, useSearchParams} from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState('');
  const [selection, setSelection] = useState<BookingSelection | null>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const updateUrl = useCallback((
    roomId: string,
    nextWeekStart: string,
  ) => {
    const parameters = new URLSearchParams();
    if (roomId) {
      parameters.set('roomId', roomId);
    }
    parameters.set('weekStart', nextWeekStart);
    router.replace(`/schedule?${parameters.toString()}`, {scroll: false});
  }, [router]);

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
        setRooms(body.data);
        const roomId = body.data.some((room) => room.id === selectedRoomId) ?
          selectedRoomId :
          body.data[0]?.id ?? '';
        setSelectedRoomId(roomId);
        updateUrl(roomId, weekStart);
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
  }, [minCapacity, selectedRoomId, updateUrl, weekStart]);

  useEffect(() => {
    if (!selectedRoomId) {
      return;
    }
    const controller = new AbortController();
    async function loadSchedule() {
      setScheduleLoading(true);
      setScheduleError('');
      try {
        const response = await fetch(
          `/api/rooms/${selectedRoomId}/schedule?weekStart=${weekStart}`,
          {signal: controller.signal},
        );
        const body = await response.json() as ApiResponse<Schedule>;
        if (!response.ok || !body.data) {
          throw new Error(
            body.error?.message ?? 'Unable to load the schedule.',
          );
        }
        setSchedule(body.data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          return;
        }
        setScheduleError(
          error instanceof Error ?
            error.message :
            'Unable to load the schedule.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setScheduleLoading(false);
        }
      }
    }
    void loadSchedule();
    return () => controller.abort();
  }, [refreshKey, selectedRoomId, weekStart]);

  useEffect(() => {
    if (!toastMessage) {
      return;
    }
    const timeout = window.setTimeout(() => setToastMessage(''), 4_000);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const selectedRoom = useMemo(
    () => rooms.find((room) => room.id === selectedRoomId) ??
      schedule?.room ??
      null,
    [rooms, schedule, selectedRoomId],
  );

  function changeRoom(roomId: string) {
    setSelectedRoomId(roomId);
    updateUrl(roomId, weekStart);
  }

  function changeWeek(weeks: number) {
    const nextWeek = DateTime.fromISO(weekStart, {zone: officeTimeZone})
      .plus({weeks})
      .toFormat('yyyy-LL-dd');
    setWeekStart(nextWeek);
    updateUrl(selectedRoomId, nextWeek);
  }

  function goToToday() {
    const currentWeek = currentOfficeWeek();
    setWeekStart(currentWeek);
    updateUrl(selectedRoomId, currentWeek);
  }

  function handleCreated() {
    setSelection(null);
    setToastMessage('Booking created');
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
            bookings={schedule?.bookings ?? []}
            loading={scheduleLoading || roomsLoading}
            officeTimeZone={schedule?.officeTimeZone ?? officeTimeZone}
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
      {toastMessage ? <Toast message={toastMessage} /> : null}
    </section>
  );
}
