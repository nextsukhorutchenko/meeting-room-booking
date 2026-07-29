# Roomwork concept framework

## Status and scope

- **Stage:** visual exploration before production implementation
- **Source of truth:** `docs/design/02-redesign-spec.md`
- **Evaluation input:** nine primary screenshots defined in
  `docs/design/evidence/concepts/README.md`
- **Scoring status:** intentionally blank until all nine screenshots are
  available and reviewed at their target dimensions

The three concepts below are visual interpretations of the approved
specification. They do not create latitude to change API contracts, booking
rules, routes, localization, responsive modes, state ownership, accessibility
semantics, focus behavior, or notification behavior.

## Shared constraints

Every concept must preserve:

- Ukrainian `uk-UA` UI, `Roomwork`, and `Бронювання переговорних`;
- exactly two primary destinations: `Розклад` and `Мої бронювання`;
- 7-day native table at `1440x900`;
- 3-day native table at `900-1359px`;
- 2-day native table at `600-899px`;
- 1-day chronological agenda below `600px` and in compact zoom modes;
- expanded `248px / timetable / 320px` supporting-pane composition;
- visible free-slot action before hover;
- default 30-minute booking and 30-240 minute valid range;
- existing office-hour, timezone, conflict, cancellation, URL, pagination,
  session, notification, and race-protection behavior;
- 44 by 44 CSS px product target for standalone controls;
- status meaning through text, icon, border, or shape in addition to color;
- native table/list semantics, with no partial `role="grid"` model;
- WCAG 2.2 AA, 320px reflow, 200% zoom, forced-colors, reduced motion, and
  deterministic focus restoration;
- the approved semantic palette, system font stack, 8px spacing rhythm, and
  restrained radii/elevation.

The concepts may differ in:

- visual hierarchy and emphasis;
- density within the approved dimensions;
- divider weight and surface grouping;
- date, time, and booking-block presentation;
- selected-path treatment;
- mobile agenda rhythm;
- how the booking summary is visually connected to the selected slot.

## Concept A - Operational Rails

### Intent

Make Roomwork feel like a precise operations tool. Strong structural rails
separate room discovery, time comparison, and booking completion, so each
region can be scanned independently without losing the overall workflow.

### Visual grammar

- Flat white work surfaces on the neutral canvas.
- Clear 1px region dividers and a stronger 2px selected-room leading rail.
- Compact toolbar groups aligned to the timetable columns.
- Teal is reserved for primary action, selection, and focus; most structure is
  neutral.
- Booking states use stable border patterns, small status icons, and short
  labels.
- Minimal shadow, used only for modal sheets and popovers.
- Controls look tool-like rather than promotional: explicit labels, familiar
  Lucide-style icons, and predictable rectangular hit areas.

### Information density

This is the densest concept, but not the smallest. It uses the full approved
13px timetable title and 12px metadata minimum, 52px slot rows, and 44px
standalone targets. Secondary text stays close to its primary value to reduce
eye travel.

### Desktop schedule treatment

- The room pane, timetable, and booking pane read as three vertical rails.
- The timetable has the most visible line structure of the three concepts.
- Day headers align tightly with the 64px time gutter.
- Current day uses a restrained warm background; current time uses a clear
  orange line and a text time marker.
- Available slots have a quiet but persistent `+ Забронювати` or icon-plus-label
  affordance sized to fit the cell.
- Own and other bookings use leading borders plus `Ваше` and `Зайнято`.
- The empty booking pane looks active and useful, with a concise instruction
  aligned to the selected room summary, not like a blank placeholder card.

### Mobile schedule and booking flow

- The agenda uses a fixed time rail on the left and full-width content/action
  rows on the right.
- Thin horizontal separators reinforce the 30-minute rhythm.
- Date strip buttons are compact and explicit, with selected and today states
  expressed by border, text, and marker.
- Room summary and filter action form one operational row.
- The booking sheet continues the rail logic: summary, form, availability
  guidance, and action are separated by rules rather than cards.

### Accessibility strengths

- Strong region boundaries and predictable alignment support scanning.
- State borders and labels survive monochrome and forced-colors treatment.
- Persistent free-slot affordances reduce hover dependence.
- Rectangular controls make 44px hit areas visually obvious.

### Accessibility risks to inspect

- Dense separators must not create visual noise that hides focus.
- Small status labels must stay at or above the approved type minimum.
- Neutral rules used as meaningful control boundaries must meet 3:1 contrast.
- The time rail must not be mistaken for an interactive grid.

### Implementation risk

**Relative risk: low.** It maps most directly to the approved pane geometry,
native table, agenda list, and semantic token system. The main risk is
over-specifying borders across many responsive states.

## Concept B - Quiet Ledger

### Intent

Make the schedule feel like a calm shared ledger. Typography, whitespace, and
date/time hierarchy do more of the work, while structural lines recede. This
direction favors long periods of reading and comparison without becoming
editorial or decorative.

### Visual grammar

- White timetable and panes sit directly on the neutral canvas without card
  framing.
- Section identity comes from type scale, alignment, and whitespace before
  stronger borders.
- Horizontal rules are lighter and more selective than in Concept A.
- Day/date typography is prominent; controls remain compact and work-focused.
- Booking surfaces use soft semantic fills, a single meaningful border, and
  clear status text.
- The teal accent appears in selection, focus, and the primary action, not as a
  page-wide color wash.
- No decorative illustrations, oversized headings, or magazine-like hero
  composition.

### Information density

This concept has the most breathing room inside pane headers and summaries,
while the timetable still retains exact 52px rows and required first-viewport
density. Metadata is progressively disclosed by available width, not removed
from accessible details.

### Desktop schedule treatment

- The central timetable reads as a calendar ledger with strong day headings
  and a quiet, repeated time rhythm.
- Supporting panes visually recede until they contain a selection or active
  task.
- Available slots use an always-visible textual affordance with low visual
  weight.
- Booking blocks resemble annotated entries: title first, range second, status
  anchored consistently.
- Current day and selected slot use restrained background fields plus an
  explicit label or marker.
- The booking pane uses generous internal grouping without floating cards.

### Mobile schedule and booking flow

- The agenda reads as a chronological daily log.
- Time labels form a narrow left column; booking and availability content align
  on a consistent text baseline.
- Busy multi-slot entries occupy one calm block with full range and status.
- The booking sheet uses a document-like reading order: summary, labelled
  inputs, availability note, primary action.
- Validation text appears directly under the relevant field without changing
  the overall horizontal rhythm.

### Accessibility strengths

- Strong typographic hierarchy supports comprehension at a glance.
- More open grouping can improve low-vision scanning and error association.
- Fewer decorative boundaries reduce competing signals.
- The mobile flow has a straightforward reading and focus order.

### Accessibility risks to inspect

- Subtle dividers must not become the sole low-contrast boundary of controls.
- Whitespace must not push the schedule below the approved top geometry.
- Low-emphasis available slots must remain obviously actionable before hover.
- Soft state fills still require visible text, icon, or border redundancy.

### Implementation risk

**Relative risk: medium-low.** The component model remains direct, but visual
success depends on precise typography and spacing. Small deviations can make
the concept feel either sparse or under-defined.

## Concept C - Focused Flow

### Intent

Make the active booking path unmistakable. The selected room, date, free
slot, and booking composer share a restrained visual thread, helping the user
move from discovery to confirmation without turning the product into a wizard.

### Visual grammar

- Neutral panes remain flat, but the active workflow receives a brand-soft
  background, stronger selection edge, and repeated compact context markers.
- Inactive regions stay quiet without becoming disabled or unreadable.
- The selected path uses teal plus check, selection text, and border shape.
- Booking and conflict states use clear inline banners within the existing
  pane or sheet, not extra cards or nested dialogs.
- Date and room context are repeated only where needed to prevent errors.
- Motion is optional and nonessential; the design remains complete with all
  transitions removed.

### Information density

Default density sits between A and B. The schedule remains information-rich,
while the active room and selected time receive slightly more visual space in
the surrounding summary and composer. No timetable row or mobile top budget is
allowed to grow beyond the approved geometry.

### Desktop schedule treatment

- The selected room rail, selected date header, selected slot, and booking pane
  form a restrained visual path across the three-column workspace.
- The timetable remains dominant and fully readable when no selection exists.
- Available slots have persistent actions; the selected slot adds a check or
  `Обрано` marker without layout shift.
- The booking pane clearly mirrors room, date, start, and default end time.
- Conflict changes the selected path to a dashed red treatment with
  `Конфлікт`, retains the draft, and makes refresh/retry visible without
  hiding the timetable.
- Booking blocks retain the same title, range, and status fit rules as the
  other concepts.

### Mobile schedule and booking flow

- The day agenda uses a light selected-path rail connecting the chosen start to
  the opening booking sheet.
- Free rows retain visible `Забронювати`; selection adds text and border rather
  than color alone.
- The booking sheet begins with a compact context summary that visually matches
  the selected agenda item.
- The primary action stays prominent but does not obscure the focused field,
  validation, or safe-area-aware bottom navigation.
- Full-screen compact mode preserves the same form subtree and state.

### Accessibility strengths

- Explicit selection markers reduce ambiguity between hover, focus, selected,
  pending, and conflict.
- Repeated context can reduce room/date/time booking mistakes.
- The active path can help keyboard and screen-magnifier users retain
  orientation across pane changes.
- Conflict treatment naturally supports redundant icon, text, and border cues.

### Accessibility risks to inspect

- The selected path must not rely on a continuous color field.
- Repeated context must not create duplicate or noisy accessible names.
- Brand-soft emphasis must preserve text and non-text contrast.
- Visual connection between schedule and sheet must not imply that background
  content remains interactive while a modal is open.

### Implementation risk

**Relative risk: medium.** It is compatible with the approved component and
state model, but requires disciplined selected-state styling across room,
date, timetable, pane, and modal modes. The visual thread must not become new
application state.

## Weighted evaluation matrix

### Scoring method

After all nine primary screenshots exist:

1. Review every concept at its exact target dimensions.
2. Score each criterion from `1` to `5`, where `1` is poor and `5` is
   excellent.
3. Record one evidence-based sentence for every score.
4. Calculate each weighted contribution as `score / 5 * weight`.
5. Sum weighted contributions to a maximum of `100`.
6. A concept cannot win while it violates an immutable requirement, even if
   its visual total is highest.

### Blank scorecard

Final scores are intentionally not assigned before screenshot review.

| Criterion | Exact weight | Concept A | Concept B | Concept C | Required evidence |
| --- | ---: | ---: | ---: | ---: | --- |
| Speed | 20 |  |  |  | Baseline booking path, visible free action, eye travel, control clarity |
| Calendar readability | 20 |  |  |  | Seven-day scan, 30-minute rhythm, booking fit, current/selected states |
| Mobile | 15 |  |  |  | Agenda scan, top geometry, filter access, booking-sheet continuity |
| Accessibility | 15 |  |  |  | Contrast, 44px targets, non-color states, focus, reflow risk |
| Visual quality | 15 |  |  |  | Hierarchy, consistency, craft, restrained use of color and elevation |
| Product fit | 10 |  |  |  | Calm-productivity B2B character and repeated-workflow suitability |
| Implementation risk | 5 |  |  |  | Mapping to approved components/tokens and amount of fragile styling |
| **Total** | **100** |  |  |  | Maximum `100`; no pre-review scores |

## Selection gate

The concept decision is made only after:

- all nine primary screenshots pass the evidence checklist;
- desktop and mobile frames show equivalent features and states;
- screenshot review confirms no concept gained an advantage by removing a
  requirement;
- every score has a concise evidence note;
- the preferred concept has no unresolved WCAG, geometry, or functional
  blocker.

The winning concept may be refined, but implementation must still follow
`docs/design/02-redesign-spec.md`. A screenshot cannot override the approved
specification.
