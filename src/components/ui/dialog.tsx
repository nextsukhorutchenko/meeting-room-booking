'use client';

import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import {
  usePresentationSurface,
  type ModalOwner,
} from '../app/presentation-coordinator';
import {uiCopy} from '../../lib/i18n/ui-copy';

type DialogProps = {
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  label: string;
  onClose(): void;
  open: boolean;
  owner?: Exclude<ModalOwner, 'none'>;
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
  owner,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panel, setPanel] = useState<HTMLDivElement | null>(null);
  const setPanelRef = useCallback((element: HTMLDivElement | null) => {
    panelRef.current = element;
    setPanel((current) => current === element ? current : element);
  }, []);
  const ownerActive = usePresentationSurface(
    owner ?? 'cancellation',
    panel,
    initialFocusRef,
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const panel = panelRef.current;

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
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;
      if (focusable.length === 1) {
        event.preventDefault();
        first.focus();
      } else if (!activeElement || !focusable.includes(activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [initialFocusRef, onClose, open]);

  if (!open) {
    return null;
  }

  const dialog = (
    <div className="dialog-backdrop">
      <div
        aria-label={label}
        aria-modal={owner ? ownerActive : true}
        className="dialog-panel"
        ref={setPanelRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="dialog-heading">
          <h2>{label}</h2>
          <button
            aria-label={uiCopy.closeDialog}
            className="icon-button"
            onClick={onClose}
            title={uiCopy.close}
            type="button"
          >
            <X aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
  return typeof document === 'undefined' ? dialog : createPortal(dialog, document.body);
}
