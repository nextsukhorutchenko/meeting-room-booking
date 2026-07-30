import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it} from 'vitest';
import {Spinner} from '../../src/components/ui/spinner';

describe('Spinner', () => {
  afterEach(cleanup);

  it('announces the default schedule loading state in Ukrainian', () => {
    render(<Spinner />);

    expect(screen.getByRole('status', {name: 'Завантажуємо розклад'}))
      .toHaveAttribute('aria-live', 'polite');
  });
});
