'use client';

import {X} from 'lucide-react';
import {useEffect, useRef} from 'react';
import {uiCopy} from '../../lib/i18n/ui-copy';
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
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusableSelector = [
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      'a[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const focusableElements = () => dialog ?
      Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) :
      [];

    focusableElements()[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') {
        return;
      }

      const elements = focusableElements();
      if (elements.length === 0) {
        event.preventDefault();
        dialog?.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="room-filter-surface">
      <div
        aria-label={uiCopy.roomFilters}
        aria-modal="true"
        className="room-filter"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
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
        <button
          aria-label={uiCopy.close}
          className="icon-button"
          onClick={onClose}
          title={uiCopy.close}
          type="button"
        >
          <X aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
