'use client';

import {X} from 'lucide-react';
import type {RoomSummary} from './schedule-types';
import {RoomPicker} from './room-picker';

type RoomFilterSurfaceProps = {
  isOpen: boolean;
  minCapacity: string;
  onClose(): void;
  onMinCapacityChange(value: string): void;
  onRoomChange(roomId: string): void;
  rooms: readonly RoomSummary[];
  selectedRoomId: string;
};

export function RoomFilterSurface({
  isOpen,
  minCapacity,
  onClose,
  onMinCapacityChange,
  onRoomChange,
  rooms,
  selectedRoomId,
}: RoomFilterSurfaceProps) {
  if (!isOpen) return null;

  return (
    <div aria-label="Room filters" className="room-filter-surface" role="dialog">
      <div className="room-filter">
        <RoomPicker
          onRoomChange={onRoomChange}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
        />
        <label className="control-field capacity-field">
          <span>Minimum capacity</span>
          <input
            min="0"
            onChange={(event) => onMinCapacityChange(event.target.value)}
            placeholder="Any"
            step="1"
            type="number"
            value={minCapacity}
          />
        </label>
        <button
          aria-label="Close room filters"
          className="icon-button"
          onClick={onClose}
          title="Close room filters"
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
