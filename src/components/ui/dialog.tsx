'use client';

import {X} from 'lucide-react';
import {
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';

type DialogProps = {
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  label: string;
  onClose(): void;
  open: boolean;
};

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Dialog({
  children,
  initialFocusRef,
  label,
  onClose,
  open,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const initialFocus = initialFocusRef?.current ??
      panel?.querySelector<HTMLElement>(focusableSelector);
    initialFocus?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) {
        return;
      }

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (focusable.length === 0) {
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
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
  }, [initialFocusRef, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="dialog-backdrop">
      <div
        aria-label={label}
        aria-modal="true"
        className="dialog-panel"
        ref={panelRef}
        role="dialog"
      >
        <div className="dialog-heading">
          <h2>{label}</h2>
          <button
            aria-label="Close dialog"
            className="icon-button"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
