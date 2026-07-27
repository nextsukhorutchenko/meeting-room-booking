import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {RoomFilter} from '../../src/components/schedule/room-filter';

const rooms = [
  {id: 'maple', name: 'Maple', floor: 1, capacity: 4},
  {id: 'pine', name: 'Pine', floor: 2, capacity: 8},
];

afterEach(cleanup);

describe('RoomFilter', () => {
  it('shows available rooms and reports a room selection', async () => {
    const onRoomChange = vi.fn();
    render(
      <RoomFilter
        minCapacity=""
        onMinCapacityChange={vi.fn()}
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

  it('reports minimum capacity changes without hiding the selected room locally', async () => {
    const onMinCapacityChange = vi.fn();
    render(
      <RoomFilter
        minCapacity=""
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

  it('disables room selection when the filtered result is empty', () => {
    render(
      <RoomFilter
        minCapacity="20"
        onMinCapacityChange={vi.fn()}
        onRoomChange={vi.fn()}
        rooms={[]}
        selectedRoomId=""
      />,
    );

    expect(screen.getByRole('combobox', {name: 'Room'})).toBeDisabled();
    expect(screen.getByRole('option', {name: 'No rooms available'}))
      .toBeVisible();
  });
});
