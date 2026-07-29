# Official Accessibility and Adaptive Design Guidance

Research date: 2026-07-29

## Scope and method

This note applies official guidance to the current Meeting Room Booking
schedule, booking flow, authentication, and notifications. It is a design
research artifact, not a claim of WCAG conformance. Only the official sources
listed below were used. No project code, screenshots, prompts, or data were
submitted to Google Stitch or any other external design service.

The current implementation was inspected locally. Relevant observations are:

- `week-grid.tsx` and `day-schedule.tsx` use `role="grid"`, but each day is one
  `gridcell`; the slot buttons inside remain ordinary sequential tab stops and
  there is no arrow-key focus model.
- `dialog.tsx` moves focus inside, traps `Tab`, closes on `Escape`, includes a
  close button, and normally returns focus to the previously focused element.
  The backdrop blocks ordinary pointer access, but the implementation should
  still verify that background content is inert for every supported input and
  assistive-technology path.
- Login and registration allow paste and browser autofill and use password
  autocomplete tokens. Login currently identifies the email field as `email`
  rather than the more specific authentication token `username`.
- Success and notification messages use status semantics; form and conflict
  errors use alert semantics.
- Desktop schedule geometry has a fixed `58rem` minimum. Below `48rem`, the app
  replaces the week view with a one-day view. Booking text is visually
  truncated inside fixed-height blocks.
- There is no explicit reduced-motion or forced-colors treatment.

## Key conclusions

1. **Do not keep the current partial ARIA grid model.** In APG, `grid` is a
   composite widget: one contained focus target is in the page tab sequence,
   and the author implements directional navigation. The current semantics
   promise behavior that is not present.
2. **Prefer a native timetable/table on desktop and a day-centric list on
   mobile.** Use ARIA `grid` only if the product deliberately implements and
   tests the complete two-dimensional keyboard model. A table keeps ordinary
   controls in normal tab order; a mobile list avoids forcing a spreadsheet
   interaction onto a single-column schedule.
3. **Use an adaptive supporting-pane model.** Keep schedule as the main pane.
   On expanded widths, show booking details/actions in a non-modal supporting
   pane. On compact widths, use a modal sheet or full-screen panel. On medium
   widths, choose side-by-side or single-pane presentation when the content,
   not a device name, stops fitting.
4. **Treat modal behavior as a complete contract.** Outside content must be
   inert, focus must remain inside, `Escape` and a visible close control must
   work, and closing must return focus to the invoking slot. If that slot was
   removed by a refresh or conflict, focus must move to a logical replacement,
   such as the same time position, the next available slot, or the day heading.
5. **WCAG 2.5.8 is 24 by 24 CSS pixels, not 44.** Meeting that minimum or its
   spacing exception is required at Level AA. For a touch-first booking
   product, use about 44 CSS pixels as the design target, informed by Apple's
   44 by 44 point default control size, while recognizing that points and CSS
   pixels are not identical units.
6. **The timetable exception does not exempt the whole page from reflow.**
   WCAG permits two-dimensional scrolling for a schedule when its row/column
   relationships are essential. Toolbars, filters, headings, auth, booking
   panels, notifications, and each cell's readable content still need to fit
   and work at 320 CSS pixels.
7. **At 200% zoom, do not trade information for geometry.** Labels, booking
   titles, times, errors, and controls must not clip, overlap, or become
   unavailable. Replace the dense week view with a day/list view before
   relying on ellipsis or fixed heights.
8. **Status cannot be color-only.** Keep visible text, icons, borders, or shape
   differences for "yours", occupied, available, selected, conflict, success,
   and error. These distinctions must survive monochrome and forced-colors
   rendering.
9. **Authentication is already close to the WCAG 3.3.8 path.** Preserve
   password-manager autofill and paste, never add a memory puzzle or
   transcription-only CAPTCHA, use `username` for the login email identity,
   and keep `current-password` and `new-password` tokens.
10. **Stitch is an ideation tool, not an accessibility validator.** Generated
    layouts or frontend code still require semantic review, keyboard testing,
    zoom/reflow testing, contrast checks, and assistive-technology testing.

## Schedule semantics: grid, table, or list

### What `role="grid"` commits the product to

The APG grid pattern defines a composite widget. It expects:

- one focusable grid descendant in the page tab sequence;
- author-managed focus movement with `Arrow` keys;
- `Home` and `End`, with `Ctrl+Home` and `Ctrl+End` commonly supported;
- every data cell to be focusable or contain a focusable element;
- `row` containers and `gridcell`, `rowheader`, or `columnheader` children that
  represent the actual row/column structure;
- a deliberate rule for whether focus lands on a cell or its single widget.

The current model has seven day-column cells rather than a row for every time
slot. It also exposes many slot buttons through normal `Tab` order. Adding a
few arrow handlers would not be sufficient; the accessibility tree and focus
ownership need to represent the actual time-by-day matrix.

### Recommended semantic direction

**Desktop/tablet week schedule:** prefer a native table/timetable when each
30-minute time row and day column can be represented truthfully. Put one
ordinary button or link in an actionable cell. Use native headers and normal
tab order. A booking that spans slots must retain an accessible start/end
description even if the visual block spans rows.

**Mobile and narrow zoomed layouts:** prefer sections by date with a heading
and a list of bookings and available times. Keep chronological order and use
buttons such as "Book Tuesday, 10:30 in Oak". This is semantically simpler and
more efficient than a one-column ARIA grid.

**ARIA grid alternative:** use only if spreadsheet-like arrow navigation is a
product requirement. Implement roving focus, all APG keys, cell/header
relationships, focus restoration after data refresh, and an announced
selection state. Test with keyboard and screen readers before release.

## Adaptive layout implications

### Desktop, expanded width

- Main pane: weekly schedule, room context, filters, and date navigation.
- Supporting pane: selected slot summary, title, duration/end time, conflict
  recovery, and primary booking action.
- Keep the main pane dominant. The official canonical-layout guidance uses an
  approximate 70/30 split for expanded supporting-pane layouts.
- A non-modal pane preserves schedule context and avoids repeated modal focus
  transitions. Selection in the schedule must be conveyed by more than color.
- Show enabled, hovered, focused, pressed, selected, loading, conflict, and
  unavailable states consistently. Material states guidance calls for
  redundant visual indicators, not a hue change alone.

### Tablet and medium width

- Let content determine the breakpoint. Do not assume every tablet has a wide
  window or touch-only input.
- Keep schedule and booking pane side by side only while both remain readable
  at large text sizes. Otherwise show one pane at a time and preserve selected
  room, date, time, title draft, and scroll position.
- Support keyboard, pointer, touch, and window resizing. Do not make hover the
  only way to discover that a free slot is actionable.

### Mobile and compact width

- Use one day at a time or a chronological day list; do not shrink the seven-day
  week grid into unreadable columns.
- Open booking as a modal bottom sheet or full-screen panel with a visible
  heading and close action. The panel itself must scroll within the viewport.
- Keep primary actions reachable without a fixed footer obscuring focused
  fields. When the on-screen keyboard opens, focused fields and errors must
  remain visible.
- Preserve the selected time and return focus to its invoker or a documented
  logical fallback after close.

## Booking dialog and sheet focus

The current dialog covers most APG basics. Retain these behaviors:

- move focus inside when opened;
- contain `Tab` and `Shift+Tab`;
- close on `Escape`;
- provide a visible close button;
- use `role="dialog"` and `aria-modal="true"` only while outside content is
  actually inert;
- expose the visible title as the accessible name.

The focus trap must include every tabbable descendant, including any links or
controls added later, and must continue to work as validation and conflict
controls appear dynamically.

Refine the focus policy by content:

- Booking form: initial focus on Title is reasonable because the date/time
  summary is short and visible.
- Destructive cancellation: initial focus should favor the least destructive
  action.
- Long or structurally rich content: focus a static heading or introduction
  with `tabindex="-1"` so the beginning is not scrolled away.
- On close, verify that the invoker is still connected and focusable. If not,
  use a deterministic workflow fallback instead of allowing focus to fall to
  the document body.

## Targets, focus, and interaction states

- WCAG AA baseline: every pointer target contains a 24 by 24 CSS pixel area, or
  qualifies for the defined spacing/equivalent/inline/user-agent/essential
  exception.
- Product design target: use approximately 44 by 44 CSS pixels for primary
  touch controls and dense schedule slots where feasible. Current 40-pixel bell
  and cancel controls and 32-pixel notification dismiss controls exceed WCAG's
  minimum but are below Apple's default touch-control benchmark.
- Do not claim that browser zoom makes an undersized target conform; WCAG
  target sizing is evaluated in CSS pixels independently of zoom.
- Keep a visible, high-contrast focus indicator for every interactive element.
  It must not depend only on color, and meaningful control/focus graphics need
  at least 3:1 contrast against adjacent colors.
- Fixed headers, toasts, sheets, and sticky actions must not entirely hide the
  focused component. Prefer placement that reserves space; otherwise provide a
  dismiss mechanism that does not require advancing focus.
- An available slot needs a discoverable enabled state before hover. Hover,
  focus, pressed, selected, loading, and unavailable states must not shift the
  layout or erase the control's accessible name.

## Authentication

- Keep visible labels and specific accessible names.
- On login, identify the email-as-account field with `autocomplete="username"`;
  retain `autocomplete="current-password"`.
- On registration, retain `autocomplete="name"`, `email`, and `new-password`.
- Do not block autofill, password managers, copy, or paste.
- Do not introduce a puzzle, memorized site-specific answer, transcription
  challenge, or recovery step that has no non-cognitive alternative.
- If MFA is added, offer a path that does not require memorizing or transcribing
  a code when feasible, such as a platform credential or confirmation flow.
- Announce form errors and associate field errors with their inputs. Move focus
  to the first invalid field or an error summary when submission fails, without
  causing an unexpected context change.
- At 200% zoom and 320 CSS pixels, keep every field, error, and action in one
  reading column. Do not disable browser zoom.

## Notifications and status

- Use `role="status"` or a polite live region for booking success, background
  refresh results, and non-urgent handoff reminders. These must be announced
  without stealing focus.
- Reserve `role="alert"` or assertive announcements for important,
  time-sensitive errors. Do not make routine polling updates interruptive.
- Batch or de-duplicate repeated notifications. The bell's accessible name
  should expose the unread count, while the visible badge remains redundant.
- Every notification needs readable text; icon and color can reinforce but not
  replace its meaning.
- A fixed notification region must not cover focused header controls, booking
  actions, or bottom-of-page controls at narrow widths or zoom.
- Dismissal targets should meet the product's larger touch benchmark. Removing
  a focused notification must move focus to the next notification, the bell, or
  another logical target.

## Reflow, zoom, motion, and contrast acceptance implications

### 320 CSS pixel reflow

- No page-level horizontal scrolling for auth, headings, toolbar, filters,
  booking panel/sheet, or notifications.
- If the timetable needs two-dimensional scrolling, contain that scrolling
  inside the timetable. Do not let its fixed minimum width force the whole page
  to scroll.
- Each booking/cell must expose readable text that fits in its own viewport or
  has an adjacent/detail view that provides the full information.
- Prefer the mobile day/list adaptation even though the timetable can qualify
  for the WCAG two-dimensional-layout exception.

### 200% zoom

- Text doubles without loss of content or functionality.
- Controls, labels, errors, dialog headings, and notification text wrap rather
  than overlap or clip.
- Replace dense multi-column layout with stacked/day layout when needed.
- Ellipsis in fixed-height booking blocks is not sufficient for sighted users
  with low vision unless the full text is available through an operable detail
  view.

### Reduced motion

- Honor `prefers-reduced-motion: reduce`.
- Remove nonessential pane, sheet, toast, selection, and loading motion.
- Replace rotating spinners with static progress text/indicators when reduced
  motion is requested; preserve the same status announcement.
- Never use motion as the only indication that selection or state changed.

### High contrast and forced colors

- Test with increased contrast and forced-colors modes, not only a contrast
  checker in the default palette.
- Ensure focus rings, input boundaries, selected slots, current time, conflicts,
  and status icons remain visible when authored backgrounds are suppressed.
- Preserve text/icon/shape labels such as "Yours", "Selected", "Conflict", and
  "Unavailable" so schedule meaning survives monochrome rendering.
- Do not remove system outlines. Prefer semantic/system colors in forced-colors
  overrides and let icons inherit the current text color.

## Official sources

### Material Design 3 and Google adaptive guidance

- Canonical layouts, including supporting pane:
  https://developer.android.com/develop/adaptive-apps/guides/canonical-layouts
- Supporting-pane implementation model:
  https://developer.android.com/develop/adaptive-apps/guides/build-a-supporting-pane-layout
- Material Design 3 interaction states:
  https://m3.material.io/foundations/interaction/states/overview

The maintained Android canonical-layout guidance explicitly states that it is
derived from Material Design guidance and applies the same patterns across
compact, medium, and expanded widths.

### Apple Human Interface Guidelines

- Design principles:
  https://developer.apple.com/design/human-interface-guidelines/design-principles
- Accessibility:
  https://developer.apple.com/design/human-interface-guidelines/accessibility
- Layout:
  https://developer.apple.com/design/human-interface-guidelines/layout
- Typography:
  https://developer.apple.com/design/human-interface-guidelines/typography
- Color:
  https://developer.apple.com/design/human-interface-guidelines/color

### WCAG 2.2

- WCAG 2.2 Recommendation: https://www.w3.org/TR/WCAG22/
- 1.4.1 Use of Color:
  https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- 1.4.4 Resize Text:
  https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html
- 1.4.10 Reflow:
  https://www.w3.org/WAI/WCAG22/Understanding/reflow.html
- 1.4.11 Non-text Contrast:
  https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- 2.3.3 Animation from Interactions:
  https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html
- 2.4.11 Focus Not Obscured (Minimum):
  https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html
- 2.5.8 Target Size (Minimum):
  https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- 3.3.8 Accessible Authentication (Minimum):
  https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
- 4.1.3 Status Messages:
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html

### WAI-ARIA Authoring Practices Guide

- Grid pattern: https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- Modal dialog pattern:
  https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/

### Responsive web and Google Stitch

- web.dev responsive web design basics:
  https://web.dev/articles/responsive-web-design-basics
- Official Google Stitch introduction:
  https://developers.googleblog.com/en/stitch-a-new-way-to-design-uis/
- Official 2026 Stitch design-canvas update:
  https://blog.google/innovation-and-ai/models-and-research/google-labs/stitch-ai-ui-design/
