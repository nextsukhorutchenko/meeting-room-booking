import '@testing-library/jest-dom/vitest';
import {readFileSync} from 'node:fs';
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

  it.each([
    [900, 224, 635],
    [900, 320, 539],
    [1024, 224, 759],
    [1024, 320, 663],
  ])(
    'reserves a %ipx viewport with a %ipx medium pane for a %ipx timetable',
    (viewportWidth, paneWidth, expectedCentralWidth) => {
      const centralWidth = viewportWidth - 32 - 8 - 1 - paneWidth;
      expect(centralWidth).toBe(expectedCentralWidth);
    },
  );

  it('encodes the exact medium pane-swap geometry without a second reserved pane', () => {
    const layoutCss = readFileSync(
      'src/app/styles/schedule-layout.css',
      'utf8',
    );
    const bookingCss = readFileSync(
      'src/app/styles/booking-surface.css',
      'utf8',
    );

    expect(layoutCss).toMatch(
      /--schedule-medium-room-pane-width:\s*224px/,
    );
    expect(layoutCss).toMatch(
      /padding:\s*var\(--space-1\)\s+var\(--space-2\)/,
    );
    expect(bookingCss).toMatch(
      /--schedule-booking-pane-width:\s*320px/,
    );
    expect(bookingCss).toMatch(
      /@media \(min-width: 900px\) and \(max-width: 1359px\)[\s\S]*\.schedule-workspace\[data-booking-open="true"\][\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+calc\(/,
    );
    expect(bookingCss).toMatch(
      /\.schedule-workspace\[data-booking-open="false"\][\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/,
    );
  });
});
