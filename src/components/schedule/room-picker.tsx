'use client';

import type {RoomSummary} from './schedule-types';

type RoomPickerProps = {
  onRoomChange(roomId: string): void;
  rooms: readonly RoomSummary[];
  selectedRoomId: string;
};

export function RoomPicker({
  onRoomChange,
  rooms,
  selectedRoomId,
}: RoomPickerProps) {
  return (
    <label className="control-field room-picker">
      <span>Room</span>
      <select
        disabled={rooms.length === 0}
        onChange={(event) => onRoomChange(event.target.value)}
        value={selectedRoomId}
      >
        {rooms.length === 0 ? (
          <option value="">No rooms available</option>
        ) : rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}, {room.capacity} people
          </option>
        ))}
      </select>
    </label>
  );
}
