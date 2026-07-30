'use client';

import {X} from 'lucide-react';
import {createPortal} from 'react-dom';
import {
  useCallback,
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
import {useFocusContainment} from './use-focus-containment';

type DialogProps = {
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  label: string;
  onClose(): void;
  open: boolean;
  owner?: Exclude<ModalOwner, 'none'>;
};

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

  useFocusContainment({
    active: open && (!owner || ownerActive),
    container: panel,
    onEscape: onClose,
  });

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
