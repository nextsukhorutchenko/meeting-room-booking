# Authentication And Booking

**Seed:** `e2e/seed.spec.ts`

## 1. Seeded User Authentication

### 1.1 Sign In As The Demo Organizer

**Existing coverage:** `e2e/auth.setup.ts`

**Steps:**

1. Open `/login`.
2. Enter the seeded organizer credentials from `e2e/fixtures.ts`.
3. Submit the sign-in form.

**Expected results:**

- The browser reaches `/schedule`.
- The authenticated browser state can be reused by dependent projects.

## 2. Seeded Room Booking

### 2.1 Create A Booking In A Free Oak Slot

**Existing coverage:** `e2e/booking.spec.ts`

**Steps:**

1. Open Oak's schedule for the deterministic next office week.
2. Choose Tuesday at 10:00.
3. Verify the booking dialog identifies Oak, Tuesday, and 10:00-10:30.
4. Enter the test-owned booking title.
5. Submit the booking.

**Expected results:**

- The create request returns `201`.
- The dialog closes and a booking-created status appears.
- The booking appears in the schedule and isolated test database.

### 2.2 Show A Conflict Without Closing The Dialog

**Existing coverage:** `e2e/booking.spec.ts`

**Steps:**

1. Open a deterministic free Oak slot.
2. Insert a test-owned booking for the same slot through the E2E database
   fixture.
3. Submit the open dialog.

**Expected results:**

- The dialog remains open.
- A visible conflict alert asks the user to choose another slot.
