'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

export type ModalOwner = 'none' | 'filter' | 'booking' | 'cancellation' |
  'notifications';

export type CancellationPresentationOrigin =
  | {kind: 'booking'; cancelTrigger: HTMLElement}
  | {kind: 'schedule'; invoker: HTMLElement}
  | {kind: 'history'; invoker: HTMLElement};

export type PresentationCommand =
  | {type: 'OPEN_FILTER'; trigger: HTMLElement}
  | {type: 'APPLY_FILTER'}
  | {type: 'CLOSE_FILTER'}
  | {type: 'OPEN_BOOKING'}
  | {type: 'CLOSE_BOOKING'}
  | {type: 'OPEN_CANCEL_FROM_BOOKING'; trigger: HTMLElement}
  | {type: 'OPEN_CANCEL_DIRECT'; origin: CancellationPresentationOrigin}
  | {type: 'KEEP_CANCEL'}
  | {type: 'CANCEL_ERROR_CLOSE'}
  | {type: 'CANCEL_SUCCESS'}
  | {type: 'OPEN_NOTIFICATIONS'; bell: HTMLElement}
  | {type: 'CLOSE_NOTIFICATIONS'}
  | {type: 'ROUTE_NAVIGATION'};

export type PresentationContextValue = {
  modalOwner: ModalOwner;
  modalOpen: boolean;
  request(command: PresentationCommand): 'ACCEPTED' | 'DENIED';
  registerBackground(element: HTMLElement | null): void;
};

type Surface = {
  element: HTMLElement;
  initialFocus?: HTMLElement | null;
};

type PresentationCoordinatorValue = PresentationContextValue & {
  registerSurface(
    owner: Exclude<ModalOwner, 'none'>,
    element: HTMLElement | null,
    initialFocus?: RefObject<HTMLElement | null>,
  ): void;
};

const PresentationContext = createContext<PresentationCoordinatorValue | null>(
  null,
);
const standalonePresentation: PresentationContextValue = {
  modalOpen: false,
  modalOwner: 'none',
  registerBackground: () => undefined,
  request: () => 'ACCEPTED',
};

function firstFocusable(element: HTMLElement): HTMLElement | null {
  return element.querySelector<HTMLElement>([
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'a[href]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(','));
}

function fallbackFocus(): void {
  const main = document.getElementById('main-content');
  if (main instanceof HTMLElement) {
    main.tabIndex = -1;
    main.focus();
  }
}

function setBackgroundModalState(element: HTMLElement, modalOpen: boolean): void {
  element.inert = modalOpen;
  element.toggleAttribute('inert', modalOpen);
  if (modalOpen) {
    element.setAttribute('aria-hidden', 'true');
  } else {
    element.removeAttribute('aria-hidden');
  }
}

export function usePresentationCoordinator(): PresentationContextValue {
  const context = useContext(PresentationContext);
  return context ?? standalonePresentation;
}

export function usePresentationCoordinatorAvailable(): boolean {
  return useContext(PresentationContext) !== null;
}

export function usePresentationSurface(
  owner: Exclude<ModalOwner, 'none'>,
  element: HTMLElement | null,
  initialFocus?: RefObject<HTMLElement | null>,
): boolean {
  const context = useContext(PresentationContext);

  useEffect(() => {
    context?.registerSurface(owner, element, initialFocus);
    return () => context?.registerSurface(owner, null);
  }, [context, element, initialFocus, owner]);

  return context ? context.modalOwner === owner : true;
}

export function PresentationCoordinator({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname?: string | null;
}) {
  const [modalOwner, setModalOwner] = useState<ModalOwner>('none');
  const [surfaceVersion, setSurfaceVersion] = useState(0);
  const modalOwnerRef = useRef<ModalOwner>('none');
  const backgroundRef = useRef<HTMLElement | null>(null);
  const surfacesRef = useRef(new Map<Exclude<ModalOwner, 'none'>, Surface>());
  const cancellationOriginRef = useRef<CancellationPresentationOrigin | null>(
    null,
  );
  const closeFocusRef = useRef<HTMLElement | null | 'fallback'>(null);
  const focusedOwnerRef = useRef<ModalOwner>('none');
  const modalInvokerRef = useRef<HTMLElement | null>(null);
  const pathnameRef = useRef(pathname);

  const commitOwner = useCallback((owner: ModalOwner) => {
    modalOwnerRef.current = owner;
    setModalOwner(owner);
  }, []);

  const resetPresentation = useCallback(() => {
    cancellationOriginRef.current = null;
    closeFocusRef.current = null;
    focusedOwnerRef.current = 'none';
    modalInvokerRef.current = null;
    surfacesRef.current.clear();
    commitOwner('none');
  }, [commitOwner]);

  const registerBackground = useCallback((element: HTMLElement | null) => {
    backgroundRef.current = element;
    if (element) {
      setBackgroundModalState(element, modalOwnerRef.current !== 'none');
    }
  }, []);

  const registerSurface = useCallback((
    owner: Exclude<ModalOwner, 'none'>,
    element: HTMLElement | null,
    initialFocus?: RefObject<HTMLElement | null>,
  ) => {
    if (element) {
      surfacesRef.current.set(owner, {
        element,
        initialFocus: initialFocus?.current,
      });
      if (modalOwnerRef.current === owner) {
        setSurfaceVersion((version) => version + 1);
      }
    } else {
      surfacesRef.current.delete(owner);
      // A portal move briefly detaches and reattaches its ref in the same
      // commit. Defer ownership cleanup so only a genuine active unmount wins.
      queueMicrotask(() => {
        if (
          modalOwnerRef.current === owner &&
          !surfacesRef.current.has(owner)
        ) {
          resetPresentation();
        }
      });
    }
  }, [resetPresentation]);

  const request = useCallback((command: PresentationCommand) => {
    const owner = modalOwnerRef.current;
    const close = (expected: Exclude<ModalOwner, 'none'>, focus: HTMLElement | null | 'fallback') => {
      if (owner !== expected) return 'DENIED' as const;
      closeFocusRef.current = focus;
      commitOwner('none');
      return 'ACCEPTED' as const;
    };

    switch (command.type) {
      case 'OPEN_FILTER':
        if (owner !== 'none') return 'DENIED';
        modalInvokerRef.current = command.trigger;
        commitOwner('filter');
        return 'ACCEPTED';
      case 'APPLY_FILTER':
      case 'CLOSE_FILTER':
        return close('filter', modalInvokerRef.current);
      case 'OPEN_BOOKING':
        if (owner !== 'none') return 'DENIED';
        modalInvokerRef.current = document.activeElement as HTMLElement | null;
        commitOwner('booking');
        return 'ACCEPTED';
      case 'CLOSE_BOOKING':
        return close('booking', modalInvokerRef.current);
      case 'OPEN_CANCEL_FROM_BOOKING':
        if (owner !== 'booking') return 'DENIED';
        cancellationOriginRef.current = {
          cancelTrigger: command.trigger,
          kind: 'booking',
        };
        commitOwner('cancellation');
        return 'ACCEPTED';
      case 'OPEN_CANCEL_DIRECT':
        if (owner !== 'none') return 'DENIED';
        cancellationOriginRef.current = command.origin;
        commitOwner('cancellation');
        return 'ACCEPTED';
      case 'KEEP_CANCEL':
      case 'CANCEL_ERROR_CLOSE': {
        if (owner !== 'cancellation') return 'DENIED';
        const origin = cancellationOriginRef.current;
        cancellationOriginRef.current = null;
        if (origin?.kind === 'booking') {
          closeFocusRef.current = origin.cancelTrigger;
          commitOwner('booking');
        } else {
          closeFocusRef.current = origin?.invoker ?? 'fallback';
          commitOwner('none');
        }
        return 'ACCEPTED';
      }
      case 'CANCEL_SUCCESS':
        if (owner !== 'cancellation') return 'DENIED';
        cancellationOriginRef.current = null;
        closeFocusRef.current = 'fallback';
        commitOwner('none');
        return 'ACCEPTED';
      case 'OPEN_NOTIFICATIONS':
        if (owner !== 'none') return 'DENIED';
        modalInvokerRef.current = command.bell;
        commitOwner('notifications');
        return 'ACCEPTED';
      case 'CLOSE_NOTIFICATIONS':
        return close('notifications', modalInvokerRef.current);
      case 'ROUTE_NAVIGATION':
        resetPresentation();
        return 'ACCEPTED';
    }
  }, [commitOwner, resetPresentation]);

  useEffect(() => {
    if (pathname === undefined || pathnameRef.current === pathname) return;
    pathnameRef.current = pathname;
    resetPresentation();
  }, [pathname, resetPresentation]);

  useEffect(() => {
    const background = backgroundRef.current;
    if (background) {
      setBackgroundModalState(background, modalOwner !== 'none');
    }

    const closeFocus = closeFocusRef.current;
    if (closeFocus) {
      closeFocusRef.current = null;
      focusedOwnerRef.current = modalOwner;
      if (closeFocus === 'fallback' || !closeFocus.isConnected) {
        fallbackFocus();
      } else {
        closeFocus.focus();
      }
      return;
    }

    if (modalOwner !== 'none' && focusedOwnerRef.current !== modalOwner) {
      const surface = surfacesRef.current.get(modalOwner);
      if (surface) {
        (surface.initialFocus ?? firstFocusable(surface.element) ??
          surface.element).focus();
        focusedOwnerRef.current = modalOwner;
      }
    } else if (modalOwner === 'none') {
      focusedOwnerRef.current = 'none';
    }
  }, [modalOwner, surfaceVersion]);

  const value = useMemo<PresentationCoordinatorValue>(() => ({
    modalOpen: modalOwner !== 'none',
    modalOwner,
    registerBackground,
    registerSurface,
    request,
  }), [modalOwner, registerBackground, registerSurface, request]);

  return (
    <PresentationContext.Provider value={value}>
      {children}
    </PresentationContext.Provider>
  );
}
