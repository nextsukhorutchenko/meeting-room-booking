# Concept evidence

## Purpose

This directory stores visual evidence for the three Roomwork concept
directions. The first review requires exactly nine primary screenshots:
desktop schedule, mobile schedule, and mobile booking flow for each concept.

Screenshots are evidence for comparison, not production specifications. The
approved behavior and geometry remain defined by
`docs/design/02-redesign-spec.md`.

## Naming convention

Use lowercase ASCII filenames:

```text
concept-{letter}-{surface}-{width}x{height}.png
```

Allowed primary values:

- `{letter}`: `a`, `b`, or `c`;
- `{surface}`: `desktop-schedule`, `mobile-schedule`, or
  `mobile-booking-sheet`;
- desktop dimensions: `1440x900`;
- mobile dimensions: `390x844`.

Do not append `final`, `new`, `v2`, dates, or tool names to primary filenames.
Replace a primary image only when it is a corrected render of the same concept
and state. Preserve alternates outside the primary nine and label them as
extensions.

## Nine primary screenshots

| Concept | Required file | Target state |
| --- | --- | --- |
| A - Operational Rails | `concept-a-desktop-schedule-1440x900.png` | Settled 7-day schedule with room pane, selected free slot, own/other bookings, current time, and contextual booking pane |
| A - Operational Rails | `concept-a-mobile-schedule-390x844.png` | Settled one-day agenda with date navigation, room/filter row, timezone context, free/busy/current states, and bottom navigation |
| A - Operational Rails | `concept-a-mobile-booking-sheet-390x844.png` | Booking surface opened from an available start, with summary, title, end-time control, guidance, and primary action |
| B - Quiet Ledger | `concept-b-desktop-schedule-1440x900.png` | Settled 7-day schedule with room pane, selected free slot, own/other bookings, current time, and contextual booking pane |
| B - Quiet Ledger | `concept-b-mobile-schedule-390x844.png` | Settled one-day agenda with date navigation, room/filter row, timezone context, free/busy/current states, and bottom navigation |
| B - Quiet Ledger | `concept-b-mobile-booking-sheet-390x844.png` | Booking surface opened from an available start, with summary, title, end-time control, guidance, and primary action |
| C - Focused Flow | `concept-c-desktop-schedule-1440x900.png` | Settled 7-day schedule with room pane, selected free slot, own/other bookings, current time, and contextual booking pane |
| C - Focused Flow | `concept-c-mobile-schedule-390x844.png` | Settled one-day agenda with date navigation, room/filter row, timezone context, free/busy/current states, and bottom navigation |
| C - Focused Flow | `concept-c-mobile-booking-sheet-390x844.png` | Booking surface opened from an available start, with summary, title, end-time control, guidance, and primary action |

## Evidence checklist

Complete this checklist for every primary screenshot before scoring.

### File integrity

- [ ] Filename exactly matches the primary convention.
- [ ] PNG pixel dimensions exactly match the filename.
- [ ] Image is legible at 100% scale.
- [ ] No browser chrome, Stitch controls, selection handles, prompt text, or
      unrelated canvas content appears in the captured frame.
- [ ] The image contains no real person, email, URL, credential, secret, or
      production data.

### Shared product fidelity

- [ ] Visible product copy is Ukrainian.
- [ ] Brand is `Roomwork`; descriptor is `Бронювання переговорних`.
- [ ] No landing-page, analytics-dashboard, or room-admin feature appears.
- [ ] No gradient, glassmorphism, decorative blob, nested-card, or AI-template
      treatment appears.
- [ ] Controls use familiar icons and explicit labels where the action is not
      universally obvious.
- [ ] All visible states use more than color alone.
- [ ] Available time has a visible action before hover.
- [ ] Text does not clip, overlap, or leave its control bounds.
- [ ] Static panes are flat; shadow is limited to floating or modal surfaces.

### Desktop schedule fidelity

- [ ] Frame is exactly `1440x900`.
- [ ] Header is one row and visually 64px high.
- [ ] Room pane, seven-day timetable, and 320px booking pane are all visible.
- [ ] All seven days fit without page-level horizontal scrolling.
- [ ] Timetable is the dominant work surface.
- [ ] First body row is at or above the approved 208px top gate.
- [ ] At least six working hours are fully visible.
- [ ] Time gutter and day header relationships are clear.
- [ ] Selected free slot, own booking, other booking, current day, and
      current-time line are visible.
- [ ] A compact booking exposes readable title, time range, and
      `Ваше` or `Зайнято`.
- [ ] Narrow booking blocks contain no nested Cancel action.
- [ ] Empty or active contextual pane follows the same concept grammar.

### Mobile schedule fidelity

- [ ] Frame is exactly `390x844`.
- [ ] 56px top bar and safe-area-aware bottom navigation are visible.
- [ ] Bottom navigation has exactly `Розклад` and `Мої бронювання`.
- [ ] `Сьогодні`, date navigation, room context, and `Фільтри` are visible.
- [ ] Different-zone example exposes both full timezone identifiers in visible
      text.
- [ ] Schedule is a one-day chronological agenda, not a compressed grid.
- [ ] First agenda body item is at or above the approved 296px top gate.
- [ ] Free rows show time and visible `Забронювати`.
- [ ] Multi-slot busy booking renders once with a full range.
- [ ] No page-level horizontal overflow is implied.

### Mobile booking fidelity

- [ ] Frame is exactly `390x844`.
- [ ] Booking surface is a modal bottom or full-screen sheet.
- [ ] Visible heading and close control are present.
- [ ] Background schedule is de-emphasized and conceptually inert.
- [ ] Room, date, start, and timezone context appear before editable fields.
- [ ] `Назва` and end-time or duration controls are visible.
- [ ] Default 30-minute selection is clear.
- [ ] `Забронювати` is the primary action.
- [ ] Controls visually meet the 44px product target.
- [ ] Field labels, guidance, and action are not clipped by the viewport.
- [ ] The flow does not add recurrence, editing, rescheduling, or
      drag-and-drop.

### Cross-concept comparison

- [ ] Concepts A, B, and C show equivalent features and comparable states.
- [ ] Differences come from visual grammar, density, hierarchy, and emphasis,
      not from removed requirements.
- [ ] A reads as structural and operational.
- [ ] B reads as typographic and ledger-like.
- [ ] C reads as active-path focused.
- [ ] No concept is scored until all nine primary screenshots pass.

## Winner extensions

After the weighted decision, additional screenshots for the winning direction
use this convention:

```text
winner-{surface}-{state}-{width}x{height}.png
```

Recommended winner extensions:

- `winner-desktop-schedule-empty-1440x900.png`
- `winner-desktop-schedule-conflict-1440x900.png`
- `winner-tablet-schedule-768x1024.png`
- `winner-mobile-schedule-320x800.png`
- `winner-mobile-booking-conflict-390x844.png`
- `winner-mobile-my-bookings-390x844.png`
- `winner-mobile-notifications-390x844.png`
- `winner-auth-login-1440x900.png`
- `winner-forced-colors-schedule-1440x900.png`
- `winner-zoom-200-tablet-720x450.png`

Extensions must include a state name. They do not replace the nine primary
comparison screenshots.
