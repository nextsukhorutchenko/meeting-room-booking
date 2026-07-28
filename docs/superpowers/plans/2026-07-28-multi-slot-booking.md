# Multi-Slot Booking End Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared end-time selector for contiguous 30-minute booking slots, up to four hours, on desktop and mobile with deterministic conflict refresh and full automated coverage.

**Architecture:** A pure booking-domain function generates ready-to-render end-time options from the selected start, current active bookings, office close, and browser time zone. `ScheduleClient` stores only `StartSlotSelection`, derives `BookingSelection` from the latest schedule response, and passes ready options to the shared dialog. The API remains the final overlap authority; a `BOOKING_CONFLICT` keeps the prior schedule visible while availability is refreshed.

**Tech Stack:** TypeScript, React 19, Next.js 16, Luxon, Vitest, Testing Library, Prisma/PostgreSQL, Playwright.

## Global Constraints

- Booking intervals are half-open: `[startsAt, endsAt)`.
- End times use 30-minute increments.
- Duration is 30 to 240 elapsed minutes.
- The upper boundary is `min(startsAt + 4 hours, next booking startsAt, office close)`.
- An end time equal to the next booking's start time is valid.
- Availability uses the configured office time zone, currently `Europe/Kyiv`.
- Display labels use the browser time zone.
- `ScheduleClient` state stores only `StartSlotSelection`; `BookingSelection` is derived.
- The dialog receives `endTimeOptions`, never the complete booking list.
- The server remains authoritative for races, office hours, and overlap validation.
- Preserve the existing 30-minute default, title focus, duplicate-submit guard, and cancellation behavior.
- Use the exact process-scoped database-reset consent only for test commands that invoke reset:
  `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=так, підтверджую reset meeting_room_booking_test`.
- Do not persist the reset consent or any credential in a file.

## File Structure

- Create `src/modules/bookings/end-time-options.ts`: pure end-time option generation and display-label formatting.
- Create `src/components/schedule/booking-selection.ts`: frontend selection contracts shared by grids, client, and dialog.
- Modify `src/components/schedule/week-grid.tsx`: emit `StartSlotSelection`.
- Modify `src/components/schedule/day-schedule.tsx`: emit `StartSlotSelection`.
- Modify `src/components/schedule/schedule-client.tsx`: store start selection, derive current options, and own conflict refresh state.
- Modify `src/components/schedule/booking-dialog.tsx`: select an end time and report conflict refresh actions.
- Modify `src/app/globals.css`: keep the new control and retry state contained on desktop and mobile.
- Create `tests/unit/end-time-options.test.ts`: pure generator boundary coverage.
- Modify `tests/unit/booking-dialog.test.tsx`: end-time control and request-body coverage.
- Modify `tests/unit/schedule-client.test.tsx`: derived-option and conflict-refresh coverage.
- Modify `tests/integration/booking-api.test.ts`: exact persistence, adjacency, and multi-slot conflict coverage.
- Modify `e2e/booking.spec.ts`: desktop multi-slot booking.
- Modify `e2e/mobile.spec.ts`: mobile multi-slot booking.
- Modify `specs/e2e/auth-and-booking.md`: executable E2E behavior description.

---

### Task 1: Pure End-Time Option Generator

**Files:**
- Create: `src/modules/bookings/end-time-options.ts`
- Create: `tests/unit/end-time-options.test.ts`

**Interfaces:**
- Consumes: ISO instants, active booking intervals, office close hour, office time zone, and browser time zone.
- Produces:

```ts
export type BookingEndTimeOption = {
  durationLabel: string;
  durationMinutes: number;
  endsAt: string;
  endTimeLabel: string;
  rangeLabel: string;
};

export type BookingAvailabilityInterval = {
  endsAt: string;
  startsAt: string;
};

export function buildBookingEndTimeOptions(input: {
  bookings: readonly BookingAvailabilityInterval[];
  officeCloseHour: number;
  officeTimeZone: string;
  startsAt: string;
  userTimeZone: string;
}): readonly BookingEndTimeOption[];
```

- [ ] **Step 1: Write the failing boundary tests**

Create tests with a helper that starts at
`2026-07-28T10:00:00+03:00`. Cover:

```ts
it('offers every half hour through exactly four hours', () => {
  const options = build({bookings: []});
  expect(options).toHaveLength(8);
  expect(options.at(-1)).toMatchObject({
    durationMinutes: 240,
    endsAt: '2026-07-28T11:00:00.000Z',
  });
});

it('stops at office close', () => {
  const options = build({
    startsAt: '2026-07-28T17:30:00+03:00',
  });
  expect(options.map((option) => option.durationMinutes))
    .toEqual([30, 60, 90]);
});

it('includes an end equal to the earliest next booking start', () => {
  const options = build({
    bookings: [
      interval('2026-07-28T15:00:00+03:00', '2026-07-28T16:00:00+03:00'),
      interval('2026-07-28T12:00:00+03:00', '2026-07-28T13:00:00+03:00'),
    ],
  });
  expect(options.at(-1)).toMatchObject({
    durationMinutes: 120,
    endsAt: '2026-07-28T09:00:00.000Z',
  });
});

it('returns no options when a booking overlaps the selected start', () => {
  expect(build({
    bookings: [
      interval('2026-07-28T09:30:00+03:00', '2026-07-28T10:30:00+03:00'),
    ],
  })).toEqual([]);
});

it('formats labels in the browser zone', () => {
  const [option] = build({
    userTimeZone: 'America/New_York',
  });
  expect(option).toMatchObject({
    durationLabel: '30 min',
    endTimeLabel: '03:30',
    rangeLabel: '03:00-03:30',
  });
});
```

- [ ] **Step 2: Run the new test and verify RED**

Run:

```powershell
npx vitest run tests/unit/end-time-options.test.ts
```

Expected: FAIL because `end-time-options.ts` and
`buildBookingEndTimeOptions` do not exist.

- [ ] **Step 3: Implement the minimal pure generator**

Use Luxon to:

1. parse the start as an absolute instant;
2. convert it to `officeTimeZone`;
3. construct office close on that office-calendar day;
4. scan unsorted bookings for an overlap at the selected start or the earliest
   later start;
5. generate `+30` minute candidates through the inclusive minimum boundary;
6. format end and range labels with `formatInUserZone`.

Use explicit duration copy:

```ts
function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${minutes} min`;
  const hoursText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  return remainder === 0 ? hoursText : `${hoursText} ${remainder} min`;
}
```

Do not sort or mutate the input array. Return `[]` for an invalid start,
invalid office zone, an already-overlapped start, or a boundary before the
first 30-minute candidate.

- [ ] **Step 4: Run focused and related time tests**

Run:

```powershell
npx vitest run tests/unit/end-time-options.test.ts tests/unit/booking-interval.test.ts tests/unit/office-time.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/modules/bookings/end-time-options.ts tests/unit/end-time-options.test.ts
git commit -m "feat: generate available booking end times"
```

---

### Task 2: Derived Selection And Shared End-Time Control

**Files:**
- Create: `src/components/schedule/booking-selection.ts`
- Modify: `src/components/schedule/week-grid.tsx`
- Modify: `src/components/schedule/day-schedule.tsx`
- Modify: `src/components/schedule/schedule-client.tsx`
- Modify: `src/components/schedule/booking-dialog.tsx`
- Modify: `src/app/globals.css`
- Modify: `tests/unit/booking-dialog.test.tsx`
- Modify: `tests/unit/schedule-client.test.tsx`

**Interfaces:**
- Consumes: `buildBookingEndTimeOptions` from Task 1.
- Produces:

```ts
export type StartSlotSelection = {
  dateLabel: string;
  roomId: string;
  roomName: string;
  startsAt: string;
  startTimeLabel: string;
  timeZoneLabel: string;
};

export type BookingSelection = StartSlotSelection & {
  endTimeOptions: readonly BookingEndTimeOption[];
};
```

- [ ] **Step 1: Write failing dialog component tests**

Replace the fixed test selection with:

```ts
const selection: BookingSelection = {
  dateLabel: 'Tuesday, July 28',
  roomId: 'room-1',
  roomName: 'Oak',
  startsAt: '2026-07-28T06:00:00.000Z',
  startTimeLabel: '09:00',
  timeZoneLabel: 'Europe/Kyiv',
  endTimeOptions: [
    {
      durationLabel: '30 min',
      durationMinutes: 30,
      endsAt: '2026-07-28T06:30:00.000Z',
      endTimeLabel: '09:30',
      rangeLabel: '09:00-09:30',
    },
    {
      durationLabel: '2 hours',
      durationMinutes: 120,
      endsAt: '2026-07-28T08:00:00.000Z',
      endTimeLabel: '11:00',
      rangeLabel: '09:00-11:00',
    },
  ],
};
```

Add tests that:

```ts
it('updates the summary and request endsAt from End time', async () => {
  fetchMock.mockResolvedValue(jsonResponse({data: {id: 'booking-1'}}, 201));
  renderDialog(selection);

  await userEvent.setup().selectOptions(
    screen.getByLabelText('End time'),
    '2026-07-28T08:00:00.000Z',
  );
  expect(screen.getByText(/09:00-11:00/)).toBeVisible();

  await userEvent.setup().type(screen.getByLabelText('Title'), 'Workshop');
  await userEvent.setup().click(
    screen.getByRole('button', {name: 'Create booking'}),
  );

  expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
    startsAt: selection.startsAt,
    endsAt: '2026-07-28T08:00:00.000Z',
  });
});
```

Also verify rerendering with the selected end removed resets the select and
summary to the first available option, while rerendering with it retained keeps
the selection. Verify an empty option list displays
`This start time is no longer available. Choose another slot.` and disables
`Create booking`.

- [ ] **Step 2: Write the failing ScheduleClient derivation test**

Load a schedule, click a known free button, and assert the dialog receives
multiple end-time options:

```ts
await user.click(screen.getByRole('button', {
  name: /Book Tuesday.*11:00/i,
}));
expect(screen.getByRole('dialog', {name: 'Book Oak'})).toBeVisible();
expect(screen.getByLabelText('End time').querySelectorAll('option').length)
  .toBeGreaterThan(1);
```

The test must interact through `ScheduleClient`; do not call the generator
directly.

- [ ] **Step 3: Run component tests and verify RED**

Run:

```powershell
npx vitest run tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx
```

Expected: FAIL because the `End time` control and start-only selection contract
do not exist.

- [ ] **Step 4: Add selection contracts and emit start-only selections**

Create `booking-selection.ts` with the exact interfaces above. Update
`WeekGrid` and `DaySchedule` so `onSelectSlot` receives
`StartSlotSelection` and emits:

```ts
{
  dateLabel: dateLabel(startsAt, userTimeZone, officeTimeZone),
  roomId,
  roomName,
  startsAt: startsAt.toUTC().toISO() ?? '',
  startTimeLabel: userStartLabel,
  timeZoneLabel: userTimeZone,
}
```

Remove click-time `endsAt` and fixed range labels from both grids.

- [ ] **Step 5: Store only StartSlotSelection and derive BookingSelection**

In `ScheduleClient`, rename the stored state:

```ts
const [startSelection, setStartSelection] =
  useState<StartSlotSelection | null>(null);
```

Derive the dialog selection with `useMemo`:

```ts
const bookingSelection = useMemo<BookingSelection | null>(() => {
  if (!startSelection || !schedule) return null;
  return {
    ...startSelection,
    endTimeOptions: buildBookingEndTimeOptions({
      bookings: schedule.bookings,
      officeCloseHour,
      officeTimeZone: schedule.officeTimeZone,
      startsAt: startSelection.startsAt,
      userTimeZone,
    }),
  };
}, [
  officeCloseHour,
  schedule,
  startSelection,
  userTimeZone,
]);
```

All room/week/day close paths clear `startSelection`. Pass
`bookingSelection` to the dialog and `setStartSelection` to both grids.

- [ ] **Step 6: Implement the shared End time control**

In `BookingDialog`:

- initialize the local selected `endsAt` from the first option;
- reconcile it when `selection.endTimeOptions` changes;
- render a native select named `endsAt`;
- use `option.endsAt` as the value and
  `${option.endTimeLabel} (${option.durationLabel})` as the label;
- show the selected option's `rangeLabel` in the summary;
- submit the selected option's exact `endsAt`;
- disable submission when no option exists.

Keep Title as the initial focus target. Do not move the end-time state into
`ScheduleClient`.

Add only scoped CSS needed for full-width mobile containment:

```css
.booking-form .control-field select {
  width: 100%;
  min-width: 0;
}
```

- [ ] **Step 7: Run focused component and grid tests**

Run:

```powershell
npx vitest run tests/unit/end-time-options.test.ts tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx tests/unit/week-grid.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 8: Commit Task 2**

```powershell
git add -- src/components/schedule/booking-selection.ts src/components/schedule/week-grid.tsx src/components/schedule/day-schedule.tsx src/components/schedule/schedule-client.tsx src/components/schedule/booking-dialog.tsx src/app/globals.css tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx
git commit -m "feat: select multi-slot booking end time"
```

---

### Task 3: Conflict Refresh State Machine

**Files:**
- Modify: `src/components/schedule/schedule-client.tsx`
- Modify: `src/components/schedule/booking-dialog.tsx`
- Modify: `tests/unit/booking-dialog.test.tsx`
- Modify: `tests/unit/schedule-client.test.tsx`

**Interfaces:**
- Consumes: derived `BookingSelection` from Task 2.
- Produces:

```ts
export type ConflictRefreshState =
  | {status: 'idle'}
  | {status: 'loading'}
  | {message: string; status: 'error'};

type BookingDialogProps = {
  conflictRefresh: ConflictRefreshState;
  onClose(): void;
  onConflict(): void;
  onCreated(): void;
  onRetryConflictRefresh(): void;
  selection: BookingSelection | null;
};
```

- [ ] **Step 1: Write the failing dialog conflict tests**

Return a `409` response:

```ts
fetchMock.mockResolvedValue(jsonResponse({
  error: {
    code: 'BOOKING_CONFLICT',
    message: 'This time is already booked. Choose another slot.',
  },
}, 409));
```

Verify the dialog stays open, shows that message, and calls `onConflict`
exactly once. Rerender with `{status: 'loading'}` and verify Create is disabled
while Cancel remains available. Rerender with:

```ts
{
  status: 'error',
  message: 'Unable to refresh availability.',
}
```

Verify a separate alert and `Retry availability` action call
`onRetryConflictRefresh`.

- [ ] **Step 2: Write failing ScheduleClient refresh tests**

Test success:

1. initial schedule has no booking after Tuesday 11:00;
2. open the dialog at 11:00 and choose 13:00;
3. POST returns `BOOKING_CONFLICT`;
4. the second schedule request remains unresolved;
5. assert the prior schedule remains visible and Create is disabled;
6. resolve the second schedule with a booking starting at 12:00;
7. assert End time options are recomputed without closing the dialog;
8. assert the invalid 13:00 choice resets to the first option, 11:30;
9. assert Create is enabled again.

Test failure and retry:

1. return `503` for the conflict refresh;
2. assert the prior schedule remains visible;
3. assert `Unable to refresh availability.` and `Retry availability`;
4. assert Create remains disabled;
5. click retry and resolve the next schedule request successfully;
6. assert the error clears and Create becomes enabled.

- [ ] **Step 3: Run focused tests and verify RED**

Run:

```powershell
npx vitest run tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx
```

Expected: FAIL because the conflict refresh callbacks and state do not exist.

- [ ] **Step 4: Implement conflict detection in BookingDialog**

When a non-success response has `error.code === 'BOOKING_CONFLICT'`:

```ts
setFormError(
  body.error.message ??
  'This time is already booked. Choose another slot.',
);
onConflict();
return;
```

Use `conflictRefresh.status !== 'idle'` to disable Create. Use
`status === 'loading'` in `aria-busy`. Render a separate refresh error and
retry button only for `status === 'error'`.

- [ ] **Step 5: Implement preserved conflict refresh in ScheduleClient**

Add `ConflictRefreshState` state and distinguish a conflict-preserving request
from the existing cancellation refresh with a dedicated ref. On conflict:

```ts
function refreshAfterConflict() {
  if (scheduleState?.status === 'success') {
    setPreservedScheduleKey(scheduleState.key);
  }
  preserveScheduleOnRefreshRef.current = true;
  conflictRefreshRequestRef.current = true;
  setConflictRefresh({status: 'loading'});
  setRefreshKey((key) => key + 1);
}
```

Capture both preserve flags at the start of each schedule effect. On a
successful conflict refresh, replace `scheduleState`, clear preserved state,
and set conflict refresh to idle. On a failed conflict refresh, keep the prior
successful `scheduleState` and `preservedScheduleKey`, clear the in-flight ref,
and set:

```ts
{
  status: 'error',
  message: 'Unable to refresh availability.',
}
```

Retry calls the same preserving refresh function. Normal room/week changes
clear conflict refresh state. A cancellation refresh failure retains its
existing behavior and must not surface a booking-dialog retry error.

Compute `scheduleLoading` so a preserved failed schedule is not left behind a
permanent loading overlay:

```ts
const scheduleLoading = Boolean(
  selectedRoomId &&
  (
    conflictRefresh.status === 'loading' ||
    (
      !isCurrentSchedule &&
      !isPreservedSchedule
    ) ||
    scheduleState?.status === 'loading'
  ),
);
```

- [ ] **Step 6: Run focused and cancellation regression tests**

Run:

```powershell
npx vitest run tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx tests/unit/cancel-booking-dialog.test.tsx
```

Expected: all tests PASS, including the existing preserved cancellation block
test.

- [ ] **Step 7: Commit Task 3**

```powershell
git add -- src/components/schedule/schedule-client.tsx src/components/schedule/booking-dialog.tsx tests/unit/booking-dialog.test.tsx tests/unit/schedule-client.test.tsx
git commit -m "fix: refresh availability after booking conflicts"
```

---

### Task 4: API Multi-Slot Regression Coverage

**Files:**
- Modify: `tests/integration/booking-api.test.ts`

**Interfaces:**
- Consumes: existing `POST /api/bookings`, half-open overlap validation, and
  Prisma test helpers.
- Produces: regression proof only; no production API contract change.

- [ ] **Step 1: Add the exact multi-slot persistence test**

Create a booking from 10:00 to 13:30 and assert:

```ts
expect(response.status).toBe(201);
const body = await response.json();
expect(body.data.endsAt).toBe(
  toUtcIso(officeDate(bookingDaysFromNow, 13, 30)),
);
const persisted = await testDb.booking.findUniqueOrThrow({
  where: {id: body.data.id},
});
expect(persisted.endsAt.toISOString()).toBe(body.data.endsAt);
```

- [ ] **Step 2: Add next-start adjacency and multi-slot conflict tests**

Adjacency:

- insert an existing booking from 12:00 to 13:00;
- create 10:00 to 12:00;
- expect `201` and exact persisted `endsAt`.

Conflict:

- insert an existing booking from 12:00 to 13:00;
- attempt 10:00 to 13:30;
- expect `409 BOOKING_CONFLICT`;
- assert no booking with the attempted title was persisted.

- [ ] **Step 3: Run integration tests**

Run with the test database and process-scoped consent:

```powershell
$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='так, підтверджую reset meeting_room_booking_test'
npm run test:integration
```

Expected: all integration tests PASS. These tests exercise existing production
behavior; if a test fails, diagnose the server behavior before changing the
assertion.

- [ ] **Step 4: Commit Task 4**

```powershell
git add -- tests/integration/booking-api.test.ts
git commit -m "test: cover multi-slot booking intervals"
```

---

### Task 5: Desktop And Mobile Multi-Slot E2E

**Files:**
- Modify: `e2e/booking.spec.ts`
- Modify: `e2e/mobile.spec.ts`
- Modify: `specs/e2e/auth-and-booking.md`

**Interfaces:**
- Consumes: shared End time select, deterministic seeded user/rooms, and the
  `SCHEDULE_LAYOUT.slotHeightPx === 44` layout contract.
- Produces: user-level proof on `desktop-kyiv` and `mobile-kyiv`.

- [ ] **Step 1: Change the desktop create flow to a two-hour booking**

After opening Tuesday 10:00:

```ts
await dialog.getByLabel('End time').selectOption({
  label: '12:00 (2 hours)',
});
await expect(dialog.getByText('10:00-12:00', {exact: false})).toBeVisible();
```

Capture the POST request and assert:

```ts
expect(createPayload.endsAt).toBe(
  officeSlot(weekStart, 1, 12).toUTC().toISO(),
);
```

After creation, assert the database `endsAt`, the visible
`10:00-12:00` range, and block height:

```ts
await expect(bookingBlock).toHaveCSS('height', '172px');
```

The expected height is `4 * 44 - 4`, matching `BookingBlock`.

- [ ] **Step 2: Change the mobile create flow to a two-hour booking**

Use the existing Pine Tuesday 10:00 flow. Select `12:00 (2 hours)`, assert the
request and database `endsAt`, verify the visible range, and assert the same
`172px` block height before continuing the existing cancellation flow.

Also retain the existing mobile screenshot and horizontal-overflow checks.

- [ ] **Step 3: Update the executable E2E specification**

In `specs/e2e/auth-and-booking.md`, change the seeded booking scenario to:

1. open Tuesday 10:00;
2. verify the default 10:00-10:30 range;
3. choose End time 12:00;
4. verify 10:00-12:00;
5. create and verify exact persistence and four-slot block geometry.

Add a mobile expectation that the same End time options and geometry are
available in the daily schedule.

- [ ] **Step 4: Run targeted desktop and mobile Playwright tests**

Build and run only the affected files:

```powershell
$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='так, підтверджую reset meeting_room_booking_test'
npm run build
npx tsx scripts/run-e2e.ts e2e/booking.spec.ts e2e/mobile.spec.ts
```

Expected: desktop and mobile multi-slot flows PASS with no clipping or
horizontal overflow.

- [ ] **Step 5: Commit Task 5**

```powershell
git add -- e2e/booking.spec.ts e2e/mobile.spec.ts specs/e2e/auth-and-booking.md
git commit -m "test: verify multi-slot booking on desktop and mobile"
```

---

### Task 6: Full Verification And Review

**Files:**
- Review all files changed since `04174a0`.
- Modify only files required by blocking review findings.

**Interfaces:**
- Consumes: Tasks 1-5.
- Produces: submission-ready branch with green local and GitHub checks.

- [ ] **Step 1: Run static and unit gates**

```powershell
npm run lint
npm run typecheck
npm run check:source
npm run test
```

Expected: all commands PASS with no new warnings.

- [ ] **Step 2: Run full integration**

```powershell
$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='так, підтверджую reset meeting_room_booking_test'
npm run test:integration
```

Expected: all integration files and tests PASS.

- [ ] **Step 3: Run build and full deterministic E2E**

```powershell
$env:PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION='так, підтверджую reset meeting_room_booking_test'
npm run test:e2e
```

Expected: build and the complete deterministic Playwright matrix PASS.

- [ ] **Step 4: Review source and diff hygiene**

```powershell
git diff --check 04174a0..HEAD
git status --short --branch
git log --oneline 04174a0..HEAD
```

Review specifically:

- no booking list reaches `BookingDialog`;
- no derived `BookingSelection` is stored in state;
- half-open adjacency is preserved;
- unsorted bookings cannot extend options past the earliest start;
- failed conflict refresh keeps the prior schedule and retry action;
- Cancel remains reachable during refresh;
- desktop and mobile controls fit without overflow;
- no unrelated files or generated artifacts are committed.

- [ ] **Step 5: Run task-scoped re-review for any blocking finding**

For each blocking finding:

1. add or update a failing regression test;
2. run it and confirm RED;
3. apply the smallest fix;
4. rerun focused and affected suites;
5. commit the fix separately.

- [ ] **Step 6: Push and verify GitHub Actions**

Push `main`, monitor the resulting CI run through completion, then move
`event2-submission-ready` to the final green commit. Do not move the tag before
both the static/integration/build job and deterministic Playwright job pass.
