'use client';

import type {RefObject} from 'react';
import type {RoomSummary} from './schedule-types';
import {uiCopy} from '../../lib/i18n/ui-copy';

type RoomPickerProps = {
  onRoomChange(roomId: string): void;
  rooms: readonly RoomSummary[];
  selectRef?: RefObject<HTMLSelectElement | null>;
  selectedRoomId: string;
};

export function RoomPicker({
  onRoomChange,
  rooms,
  selectRef,
  selectedRoomId,
}: RoomPickerProps) {
  return (
    <label className="control-field room-picker">
      <span>{uiCopy.room}</span>
      <select
        disabled={rooms.length === 0}
        onChange={(event) => onRoomChange(event.target.value)}
        ref={selectRef}
        value={selectedRoomId}
      >
        {rooms.length === 0 ? (
          <option value="">{uiCopy.noRoomsAvailable}</option>
        ) : rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}, {room.capacity} {uiCopy.places}
          </option>
        ))}
      </select>
    </label>
  );
}
