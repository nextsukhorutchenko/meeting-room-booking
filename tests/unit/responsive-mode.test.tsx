import '@testing-library/jest-dom/vitest';
import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {
  getResponsiveMode,
  useResponsiveMode,
} from '../../src/components/schedule/use-responsive-mode';

function setMatchMediaWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('useResponsiveMode', () => {
  beforeEach(() => setMatchMediaWidth(1440));
  afterEach(() => setMatchMediaWidth(1440));

  it.each([
    [599, 'mobile'],
    [600, 'tablet'],
    [899, 'tablet'],
    [900, 'medium'],
    [1359, 'medium'],
    [1360, 'expanded'],
  ] as const)('resolves %ipx to %s', (width, expected) => {
    setMatchMediaWidth(width);
    expect(renderHook(() => useResponsiveMode()).result.current).toBe(expected);
    expect(getResponsiveMode(width)).toBe(expected);
  });
});
