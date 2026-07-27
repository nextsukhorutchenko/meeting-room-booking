'use client';

export type RoomOption = {
  id: string;
  name: string;
  floor: number;
  capacity: number;
};

type RoomFilterProps = {
  minCapacity: string;
  onMinCapacityChange(value: string): void;
  onRoomChange(roomId: string): void;
  rooms: RoomOption[];
  selectedRoomId: string;
};

export function RoomFilter({
  minCapacity,
  onMinCapacityChange,
  onRoomChange,
  rooms,
  selectedRoomId,
}: RoomFilterProps) {
  return (
    <div className="room-filter" aria-label="Room filters">
      <label className="control-field">
        <span>Room</span>
        <select
          disabled={rooms.length === 0}
          onChange={(event) => onRoomChange(event.target.value)}
          value={selectedRoomId}
        >
          {rooms.length === 0 ? (
            <option value="">No rooms available</option>
          ) : rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}, {room.capacity} people
            </option>
          ))}
        </select>
      </label>
      <label className="control-field capacity-field">
        <span>Minimum capacity</span>
        <input
          min="0"
          onChange={(event) => onMinCapacityChange(event.target.value)}
          placeholder="Any"
          step="1"
          type="number"
          value={minCapacity}
        />
      </label>
    </div>
  );
}
