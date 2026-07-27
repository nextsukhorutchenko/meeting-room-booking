# Cancellation And History

**Seed:** `e2e/seed.spec.ts`

## 1. Seeded User Cancellation

### 1.1 Require Confirmation Before Cancellation

**Existing coverage:** `e2e/cancellation.spec.ts`

**Steps:**

1. Create a test-owned future Oak booking through the E2E database fixture.
2. Open the deterministic next-week schedule.
3. Choose the booking's Cancel command.
4. Verify the confirmation dialog and keep the booking.

**Expected results:**

- Focus starts on Keep booking.
- No cancellation is persisted before confirmation.
- Keeping the booking closes the dialog and leaves the booking visible.

### 1.2 Cancel An Owned Future Booking

**Existing coverage:** `e2e/cancellation.spec.ts`

**Steps:**

1. Create a test-owned future Oak booking through the E2E database fixture.
2. Open the schedule and confirm cancellation.

**Expected results:**

- The delete request returns `204`.
- The booking disappears and a booking-cancelled status appears.
- The isolated test database records the cancellation timestamp.

## 2. Seeded Booking History

### 2.1 Open A History Row In The Schedule

**Existing coverage:** `e2e/my-bookings.spec.ts`

**Steps:**

1. Create a test-owned future Pine booking through the E2E database fixture.
2. Open `/my-bookings`.
3. Follow the booking title link.

**Expected results:**

- The schedule URL identifies the seeded room, week, day, and booking.
- The matching schedule booking is highlighted.

### 2.2 Cancel A Future History Row

**Existing coverage:** `e2e/my-bookings.spec.ts`

**Steps:**

1. Create a test-owned future Oak booking through the E2E database fixture.
2. Open `/my-bookings`.
3. Cancel the row through the shared confirmation dialog.

**Expected results:**

- The row disappears and a booking-cancelled status appears.
- The isolated test database records the cancellation timestamp.
