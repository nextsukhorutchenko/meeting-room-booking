'use client';

import {uiCopy} from '../../lib/i18n/ui-copy';
import {Dialog} from '../ui/dialog';
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
  return (
    <Dialog label={uiCopy.roomFilters} onClose={onClose} open={isOpen} owner="filter">
      <div className="room-filter">
        <RoomPicker
          onRoomChange={onRoomChange}
          rooms={rooms}
          selectedRoomId={selectedRoomId}
        />
        <label className="control-field capacity-field">
          <span>{uiCopy.minimumCapacity}</span>
          <input
            min="0"
            onChange={(event) => onMinCapacityChange(event.target.value)}
            placeholder={uiCopy.any}
            step="1"
            type="number"
            value={minCapacity}
          />
        </label>
      </div>
    </Dialog>
  );
}
