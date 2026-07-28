import {describe, expect, it} from 'vitest';
import {
  exploratoryMobileSchedulePath,
  exploratoryTuesday,
} from '../../e2e/exploratory/mobile-booking-date';

describe('exploratory mobile booking date', () => {
  it('selects Tuesday from the configured Monday week start', () => {
    expect(exploratoryTuesday('2026-08-03')).toBe('2026-08-04');
  });

  it('navigates the exploratory flow to that Tuesday', () => {
    expect(exploratoryMobileSchedulePath('oak', '2026-08-03')).toBe(
      '/schedule?roomId=oak&weekStart=2026-08-03&day=2026-08-04',
    );
  });
});
