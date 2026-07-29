'use client';

import {useSyncExternalStore} from 'react';
import type {ResponsiveMode} from './schedule-types';

export function getResponsiveMode(width: number): Exclude<
  ResponsiveMode,
  'unresolved'
> {
  if (width >= 1360) return 'expanded';
  if (width >= 900) return 'medium';
  if (width >= 600) return 'tablet';
  return 'mobile';
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('resize', onStoreChange);
  return () => window.removeEventListener('resize', onStoreChange);
}

function getSnapshot(): Exclude<ResponsiveMode, 'unresolved'> {
  return getResponsiveMode(window.innerWidth);
}

function getServerSnapshot(): ResponsiveMode {
  return 'unresolved';
}

export function useResponsiveMode(): ResponsiveMode {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
