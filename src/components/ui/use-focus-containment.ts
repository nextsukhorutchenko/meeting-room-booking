'use client';

import {useEffect} from 'react';

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusContainment({
  active,
  container,
  escapeDisabled = false,
  onEscape,
}: {
  active: boolean;
  container: HTMLElement | null;
  escapeDisabled?: boolean;
  onEscape(): void;
}): void {
  useEffect(() => {
    if (!active || !container) return;

    function containFocus(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!escapeDisabled) {
          onEscape();
        }
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = Array.from(
        container?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        container?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const current = document.activeElement;
      if (focusable.length === 1) {
        event.preventDefault();
        first.focus();
      } else if (!current || !focusable.includes(current as HTMLElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', containFocus);
    return () => document.removeEventListener('keydown', containFocus);
  }, [active, container, escapeDisabled, onEscape]);
}
