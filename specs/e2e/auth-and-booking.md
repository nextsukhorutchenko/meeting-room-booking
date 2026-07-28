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
3. Verify the booking dialog identifies Oak, Tuesday, and the default
   10:00-10:30 range.
4. Choose End time 12:00 (2 hours) and verify the displayed range is
   10:00-12:00.
5. Enter the test-owned booking title.
6. Submit the booking.

**Expected results:**

- The create request returns `201`.
- The dialog closes and a booking-created status appears.
- The request and isolated test database persist the exact Tuesday 12:00 UTC
  end time.
- The booking appears as 10:00-12:00 in the schedule with a `172px` block
  height: four 44px slots minus BookingBlock's 4px spacing.
- The created block and its visible content remain within Tuesday's schedule
  column, and document horizontal overflow remains `0` after creation.

### 2.2 Create A Multi-Slot Booking In The Pine Daily Schedule

**Existing coverage:** `e2e/mobile.spec.ts`

**Steps:**

1. Open Pine's daily schedule for deterministic Tuesday.
2. Choose Tuesday at 10:00 and verify the default 10:00-10:30 range.
3. Choose End time 12:00 (2 hours) and verify the displayed range is
   10:00-12:00.
4. Create the booking, then cancel it through My Bookings.

**Expected results:**

- The daily booking dialog exposes the same End time options as desktop.
- The POST request and isolated test database persist the exact Tuesday 12:00
  UTC end time.
- The daily schedule renders a visible 10:00-12:00 booking block at `172px`.
- The created block and its visible content remain within the daily column and
  viewport, and document horizontal overflow remains `0` after creation.
- The existing screenshot, cancellation, and horizontal-overflow checks remain
  in place.

### 2.3 Show A Conflict Without Closing The Dialog

**Existing coverage:** `e2e/booking.spec.ts`

**Steps:**

1. Open a deterministic free Oak slot.
2. Insert a test-owned booking for the same slot through the E2E database
   fixture.
3. Submit the open dialog.

**Expected results:**

- The dialog remains open.
- A visible conflict alert asks the user to choose another slot.
