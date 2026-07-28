# Multi-Slot Booking End Time Design

## Status

Approved on 2026-07-28.

## Goal

Allow a user to choose a booking end time on both desktop and mobile. A
booking may span contiguous 30-minute slots for a minimum of 30 minutes and a
maximum of four hours.

The existing booking API and service remain authoritative for interval,
office-hours, and overlap validation.

## Scope

- Add an `End time` control to the shared booking dialog.
- Generate only contiguous, currently available end-time options.
- Use the same behavior in the weekly desktop schedule and daily mobile
  schedule.
- Refresh the schedule after a server-side booking conflict.
- Add unit, component, integration, desktop E2E, and mobile E2E coverage.

The room, date, and start time continue to be selected from the schedule. This
change does not add drag selection, edit/reschedule behavior, recurrence, or a
separate duration mode.

## Interval Semantics

Bookings use half-open intervals:

```text
[startsAt, endsAt)
```

An end time equal to the next booking's start time is valid. For example,
`10:00-11:00` may be created immediately before an existing
`11:00-12:00` booking.

For a selected start time, the upper boundary is:

```text
min(
  startsAt + 4 hours,
  next active booking startsAt,
  office closing time
)
```

The next booking is the earliest relevant booking by start time, regardless of
the order received from the schedule API. A booking that overlaps the selected
start produces no available end-time options.

End-time candidates are generated every 30 minutes and are included when they
are less than or equal to the upper boundary.

## Time Zones

Availability and office-closing calculations use the office time zone,
`Europe/Kyiv`. The office close instant is constructed on the selected
office-calendar date.

Labels are formatted in the browser time zone. ISO values passed to the API
remain absolute UTC instants. Duration limits are evaluated as elapsed minutes,
matching the server's existing validation.

## Architecture

### Pure Shared Generator

Add a shared pure TypeScript function with no React, DOM, fetch, or component
dependencies. It accepts:

- the selected `startsAt`;
- active schedule bookings with `startsAt` and `endsAt`;
- the office closing hour and office time zone;
- the browser time zone used for display labels.

It returns immutable, ready-to-render end-time options. Each option contains:

- `endsAt` as a UTC ISO string;
- `durationMinutes`;
- a browser-zone end-time label;
- a browser-zone range label;
- a concise duration label.

The desktop and mobile schedule components emit the same start-slot selection.
`ScheduleClient`, which already owns the latest schedule response, calls the
generator and derives a `BookingSelection` containing `endTimeOptions`. The
booking dialog receives that derived selection and never receives the complete
booking list.

Because the options are derived from the current schedule response instead of
being stored as a click-time snapshot, a schedule refresh automatically
recomputes them while the dialog is open.

### Shared Dialog

The shared booking dialog:

- defaults to the first available option, normally 30 minutes;
- renders a native `End time` select;
- displays options such as `11:00 (1 hour)`;
- updates the time summary when the selection changes;
- sends the selected option's `endsAt` in the booking API request;
- preserves title validation and duplicate-submit protection.

When new `endTimeOptions` arrive while the dialog is open, the current value is
kept only if it is still present. Otherwise it resets to the first available
option.

If no options remain, the dialog explains that the start time is no longer
available and disables submission.

### Conflict Refresh

The server remains the final concurrency boundary. If booking creation returns
`BOOKING_CONFLICT`, the dialog:

1. keeps the dialog open;
2. shows a clear conflict message;
3. asks the schedule client to reload the current room and week;
4. receives recomputed end-time options from the refreshed schedule;
5. retains the selected end time if still valid, or resets it to the first
   available option.

This handles a race where another user books one or more slots after the dialog
was opened.

## Data Flow

1. The user selects a free 30-minute start slot.
2. The desktop or mobile schedule reports the selected start slot to
   `ScheduleClient`.
3. `ScheduleClient` calls the shared generator with the latest schedule data
   and passes a `BookingSelection` containing ready `endTimeOptions` to the
   shared dialog.
4. The user selects an end time and submits a title.
5. The dialog sends `roomId`, `title`, `startsAt`, and the selected `endsAt`.
6. On success, the schedule reloads and renders a block whose height reflects
   the complete duration.
7. On conflict, the schedule reloads while the dialog remains actionable.

## Error Handling

- Client options prevent known overlaps and office-hours violations.
- The API continues to reject malformed, misaligned, past, over-four-hour,
  outside-office-hours, and overlapping intervals.
- `BOOKING_CONFLICT` is shown as a user-readable alert and triggers a schedule
  refresh.
- Other API and network errors keep the current generic error behavior.
- An empty option list disables creation and directs the user to choose another
  start slot.

## Test Plan

### Unit

The pure generator covers:

- all options through exactly four hours;
- truncation at office closing time;
- truncation at the next booking;
- inclusion of `endsAt === nextBooking.startsAt`;
- unsorted booking input;
- an overlapping selected start returning no options;
- browser-zone labels while calculating the boundary in `Europe/Kyiv`.

### Component

The booking dialog covers:

- the first end time selected by default;
- changing `End time` updating the displayed range;
- changing `End time` updating the API request body;
- retaining a still-valid value after option refresh;
- resetting an unavailable value to the first available option;
- disabling submission when no options remain;
- conflict feedback and the schedule-refresh callback.

### Integration

The booking API covers:

- persisting the exact multi-slot `endsAt`;
- accepting an end time equal to the next booking's start;
- rejecting a multi-slot interval that overlaps an existing booking.

### E2E

Desktop and mobile each cover:

- opening the booking dialog from a free start slot;
- choosing a multi-slot end time;
- creating the booking successfully;
- showing the correct time range;
- persisting the exact `endsAt`;
- rendering a booking block whose height matches the selected duration without
  clipping or layout overflow.

## Acceptance Criteria

- Desktop and mobile expose the same `End time` behavior.
- Options use 30-minute increments and never exceed four hours.
- Options stop at the next booking or office close.
- Adjacency at the next booking start is allowed.
- Labels use the browser time zone; availability uses `Europe/Kyiv`.
- A changed schedule cannot leave an unavailable end time selected.
- A server-side conflict refreshes the schedule and leaves clear feedback.
- All affected unit, component, integration, and E2E checks pass.
