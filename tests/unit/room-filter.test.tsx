import '@testing-library/jest-dom/vitest';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {RoomFilterSurface} from
  '../../src/components/schedule/room-filter-surface';
import {RoomPicker} from '../../src/components/schedule/room-picker';
import {PresentationCoordinator} from '../../src/components/app/presentation-coordinator';
import {usePresentationCoordinator} from '../../src/components/app/presentation-coordinator';

const rooms = [
  {id: 'maple', name: 'Maple', floor: 1, capacity: 4},
  {id: 'pine', name: 'Pine', floor: 2, capacity: 8},
];

afterEach(cleanup);

function RoomFilterHarness() {
  return <PresentationCoordinator><RoomFilterContent /></PresentationCoordinator>;
}

function RoomFilterContent() {
  const [isOpen, setIsOpen] = useState(false);
  const {request} = usePresentationCoordinator();
  return (
    <>
      <button onClick={(event) => {
        if (request({trigger: event.currentTarget, type: 'OPEN_FILTER'}) === 'ACCEPTED') {
          setIsOpen(true);
        }
      }} type="button">
        Відкрити фільтри переговорних
      </button>
      <button type="button">Фонова команда</button>
      <RoomFilterSurface
        isOpen={isOpen}
        minCapacity=""
        onClose={() => {
          if (request({type: 'CLOSE_FILTER'}) === 'ACCEPTED') {
            setIsOpen(false);
          }
        }}
        onMinCapacityChange={vi.fn()}
        onRoomChange={vi.fn()}
        rooms={rooms}
        selectedRoomId="maple"
      />
    </>
  );
}

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

    const roomSelector = screen.getByRole('combobox', {
      name: 'Переговорна',
    });
    expect(roomSelector).toHaveValue('maple');
    expect(screen.getByRole('option', {name: 'Maple, 4 місць'})).toBeVisible();
    expect(screen.getByRole('option', {name: 'Pine, 8 місць'})).toBeVisible();

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
      screen.getByRole('spinbutton', {name: 'Мінімальна місткість'}),
      '8',
    );

    expect(onMinCapacityChange).toHaveBeenLastCalledWith('8');
    expect(screen.getByRole('option', {name: 'Maple, 4 місць'})).toBeVisible();
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

    expect(screen.queryByRole('dialog', {name: 'Фільтри переговорних'}))
      .not.toBeInTheDocument();
  });

  it('contains focus, closes with Escape, and restores focus to its invoker', async () => {
    render(<RoomFilterHarness />);
    const user = userEvent.setup();
    const invoker = screen.getByRole('button', {
      name: 'Відкрити фільтри переговорних',
    });

    await user.click(invoker);

    const dialog = screen.getByRole('dialog', {
      name: 'Фільтри переговорних',
    });
    const roomSelector = screen.getByRole('combobox', {
      name: 'Переговорна',
    });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', {name: 'Close dialog'})).toHaveFocus();

    screen.getByRole('button', {name: 'Close dialog'}).focus();
    await user.tab();
    expect(roomSelector).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(invoker).toHaveFocus();
  });
});
