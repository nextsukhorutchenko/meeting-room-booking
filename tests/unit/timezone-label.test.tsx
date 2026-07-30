import '@testing-library/jest-dom/vitest';
import {readFileSync} from 'node:fs';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {TimezoneLabel} from '../../src/components/schedule/timezone-label';

describe('TimezoneLabel', () => {
  afterEach(cleanup);

  it('exposes complete user and office IANA zones when they differ', () => {
    render(
      <TimezoneLabel
        officeCloseHour={19}
        officeOpenHour={9}
        officeTimeZone="America/Argentina/Buenos_Aires"
        userTimeZone="Europe/Kyiv"
      />,
    );

    expect(screen.getByTestId('timezone-notice')).toHaveTextContent(
      'America/Argentina/Buenos_Aires',
    );
    expect(screen.getByTestId('timezone-notice')).toHaveTextContent(
      'Europe/Kyiv',
    );
    expect(screen.getByTestId('timezone-notice')).toHaveTextContent(
      'Ваш час',
    );

    const css = readFileSync('src/app/styles/agenda.css', 'utf8');
    expect(css).toMatch(/\.timezone-notice \{[\s\S]*min-height: var\(--space-5\)/);
    expect(css).toMatch(/\.timezone-notice \{[\s\S]*overflow-wrap: anywhere/);
    expect(css).not.toMatch(/\.timezone-notice \{[\s\S]*max-height/);
  });
});
