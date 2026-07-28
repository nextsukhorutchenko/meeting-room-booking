# Clickable Booking History Row Design

## Status

Approved on 2026-07-28.

## Goal

Make every booking-history row open its corresponding booking in the schedule
when the user activates any part of the row except the `Cancel` button.

The interaction must work with pointer and keyboard input on desktop and
mobile while preserving the existing schedule deep link. Desktop row geometry
remains unchanged; mobile rows adopt the two-column layout defined below so
the link and cancel hit targets are complete and non-overlapping.

## Scope

- Expand the existing schedule link from the booking title to the row's main
  content area.
- Include the date, time, title, room, status, and remaining free space in the
  link.
- Keep `Cancel` as a separate sibling button in a dedicated right-side area.
- Add hover and `focus-visible` treatment for the row link.
- Add regression coverage for pointer navigation, keyboard navigation, and
  cancellation without navigation.

This change does not alter booking data, deep-link parameters, cancellation
behavior, list loading, sorting, pagination, or schedule highlighting.

## Structure

Each booking remains a semantic list item. The list item contains two sibling
interactive areas:

1. A Next.js `Link` that fills the row's main area and uses the existing
   booking schedule URL.
2. The existing `Cancel` button when cancellation is available.

The link contains the displayed date, time, booking title, room name, and
status. It grows to consume all space not reserved for `Cancel`. The button
occupies its own right-side layout area and is never nested inside or overlaid
on the link.

No row-level click handler, `role="link"`, overlay, `z-index`,
`stopPropagation`, or manual keyboard emulation is used.

## Interaction And Accessibility

- A pointer activation anywhere inside the link area opens the corresponding
  booking in the schedule.
- Activating `Cancel` opens only the existing confirmation dialog.
- `Tab` focuses the row link first and `Cancel` second when the button exists.
- `Enter` activates the focused link.
- `Enter` or `Space` activates the focused `Cancel` button using native button
  behavior.
- The link exposes an accessible name that identifies the booking and the
  action of opening it in the schedule.
- The link receives a visible `focus-visible` outline around its full area.
- Hover styling applies to the full link area without changing row dimensions.

## Layout

Desktop rows keep their current visual arrangement. The main link is a
flexible area with `min-width: 0`; the cancel area is non-shrinking.

Mobile rows intentionally change from a vertically stacked content row and
action footer to two columns:

- the main column is a full-height link containing the date, time, title,
  room, and status;
- the right column is the `Cancel` button itself, stretched to the full row
  height when the action is available.

The main column grows to use all space not reserved for the action column.
Existing responsive typography and wrapping rules continue to keep content
contained.

Vertical padding belongs to the two sibling controls so their hit targets fill
the complete row height. No non-interactive wrapper surrounds the mobile
button, and there must be no dead pointer area between either control and the
row boundary.

## Navigation

The existing `bookingUrl` output remains authoritative:

```text
/schedule?roomId=...&weekStart=...&day=...&bookingId=...
```

Navigation continues to open the correct week and day and highlight the
selected booking. No client-side navigation state or new routing abstraction
is added.

## Testing

### Component

- The row exposes a link whose accessible name identifies the booking.
- The link uses the existing booking deep-link URL.
- An upcoming booking renders the link before the sibling `Cancel` button.
- Activating `Cancel` opens the confirmation dialog without invoking
  navigation.

### E2E

- Clicking a non-title area of a history row opens and highlights the correct
  schedule booking.
- Focusing the row link and pressing `Enter` performs the same navigation.
- Clicking `Cancel` leaves the browser on `/my-bookings` and opens the
  confirmation dialog.
- Desktop and mobile layout checks confirm that rows and text remain contained
  without horizontal overflow.

## Acceptance Criteria

- Every visible point in a booking row is either part of the schedule link or
  part of the dedicated `Cancel` area.
- The link and button are sibling controls with non-overlapping hit targets.
- Mobile rows use the defined two-column main/action layout rather than the
  previous stacked action footer.
- Pointer and keyboard behavior match the interaction rules above.
- Existing cancellation, deep-link highlighting, and desktop layout continue
  to work; mobile containment tests pass with the intentional layout change.
