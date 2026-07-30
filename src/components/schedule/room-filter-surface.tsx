'use client';

import {uiCopy} from '../../lib/i18n/ui-copy';
import {Dialog} from '../ui/dialog';
import type {RoomSummary} from './schedule-types';
import {RoomPicker} from './room-picker';

type RoomFilterSurfaceProps = {
  isOpen: boolean;
  minCapacity: string;
  onApply(): void;
  onClose(): void;
  onMinCapacityChange(value: string): void;
  onReset(): void;
  onRoomChange(roomId: string): void;
  rooms: readonly RoomSummary[];
  selectedRoomId: string;
};

export function RoomFilterSurface({
  isOpen,
  minCapacity,
  onApply,
  onClose,
  onMinCapacityChange,
  onReset,
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
        <div className="dialog-actions room-filter-actions">
          <button
            className="secondary-button"
            disabled={!minCapacity}
            onClick={onReset}
            type="button"
          >
            {uiCopy.resetFilters}
          </button>
          <button
            className="primary-button"
            onClick={onApply}
            type="button"
          >
            {uiCopy.applyFilters}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
