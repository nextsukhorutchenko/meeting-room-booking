import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {RoomFilterSurface} from
  '../../src/components/schedule/room-filter-surface';
import {RoomPicker} from '../../src/components/schedule/room-picker';

const rooms = [
  {id: 'maple', name: 'Maple', floor: 1, capacity: 4},
  {id: 'pine', name: 'Pine', floor: 2, capacity: 8},
];

afterEach(cleanup);

describe('RoomPicker', () => {
  it('shows available rooms and reports a room selection', async () => {
    const onRoomChange = vi.fn();
    render(
      <RoomPicker
        onRoomChange={onRoomChange}
        rooms={rooms}
        selectedRoomId="maple"
      />,
    );

    const roomSelector = screen.getByRole('combobox', {name: 'Room'});
    expect(roomSelector).toHaveValue('maple');
    expect(screen.getByRole('option', {name: 'Maple, 4 people'})).toBeVisible();
    expect(screen.getByRole('option', {name: 'Pine, 8 people'})).toBeVisible();

    await userEvent.setup().selectOptions(roomSelector, 'pine');
    expect(onRoomChange).toHaveBeenCalledWith('pine');
  });

  it('keeps the selected room available while capacity draft changes', async () => {
    const onMinCapacityChange = vi.fn();
    render(
      <RoomFilterSurface
        isOpen
        minCapacity=""
        onClose={vi.fn()}
        onMinCapacityChange={onMinCapacityChange}
        onRoomChange={vi.fn()}
        rooms={rooms}
        selectedRoomId="maple"
      />,
    );

    await userEvent.setup().type(
      screen.getByRole('spinbutton', {name: 'Minimum capacity'}),
      '8',
    );

    expect(onMinCapacityChange).toHaveBeenLastCalledWith('8');
    expect(screen.getByRole('option', {name: 'Maple, 4 people'})).toBeVisible();
  });

  it('hides its controlled filter dialog when closed', () => {
    render(
      <RoomFilterSurface
        isOpen={false}
        minCapacity=""
        onClose={vi.fn()}
        onMinCapacityChange={vi.fn()}
        onRoomChange={vi.fn()}
        rooms={[]}
        selectedRoomId=""
      />,
    );

    expect(screen.queryByRole('dialog', {name: 'Room filters'}))
      .not.toBeInTheDocument();
  });
});
