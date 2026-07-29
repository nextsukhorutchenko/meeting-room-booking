# Roomwork concept decision

## Review status

- **Reviewer role:** independent concept reviewer, not prototype author
- **Decision:** Concept A - Operational Rails
- **Gate:** passed; no concept has an immutable requirement violation
- **Normative source:** `docs/design/02-redesign-spec.md`
- **Comparison source:** `docs/design/04-concept-framework.md`
- **Evidence:** nine primary PNG files in
  `docs/design/evidence/concepts/`

The screenshots are comparison evidence, not a replacement for the approved
specification. Behavior, semantics, state ownership, responsive modes, focus
transitions, timezone rules and test gates remain governed by the
specification.

Google Stitch was available only as a cross-origin embedded canvas. It did not
provide reliable prompt input or deterministic screenshot capture in the
available browser session. The permitted local prototype fallback was
therefore used for all three concepts. This tool limitation does not affect
the scores: every concept was reviewed from equivalent local renders at the
same exact dimensions and with the same product state.

## Evidence integrity

Exactly nine primary PNG files are present. Desktop files are `1440x900`;
mobile files are `390x844`. Filenames match the evidence convention. At 100%
scale, the captures contain no browser chrome, prototype controls, selection
handles, prompt text, URLs, credentials, email addresses or production data.
All visible product copy is Ukrainian, the brand is `Roomwork`, and the
descriptor is `Бронювання переговорних`.

No capture uses gradients, glassmorphism, decorative blobs, nested-card
composition or landing-page treatment. Static panes stay flat and elevation is
limited to modal sheets. No visible text or action overlaps, clips, or escapes
its control. All three directions show equivalent selected, free, own, other,
current-day and current-time states.

## Frame-by-frame checklist

| Concept and frame | Checklist evidence | Verdict |
| --- | --- | --- |
| A desktop schedule | Exact `1440x900`; one-row 64px header; room rail, seven-day timetable and 320px booking rail all fit; first body row is approximately 200px from the viewport top; more than six working hours are visible; selected free slot, own and other bookings, current day and orange current-time marker are explicit; every free cell exposes `+ Забронювати`; compact bookings retain title, range and text/icon status; no inline Cancel appears. | **Pass** |
| A mobile schedule | Exact `390x844`; 56px top bar and two-item bottom navigation are visible; `Сьогодні`, three-date navigation, room context and filter action fit; `Europe/Berlin` and `Europe/Kyiv` are both visible; the chronological agenda begins at the 296px gate; free actions remain textual; multi-slot bookings render once with full ranges; selected, own, occupied and current states use text, icons and borders in addition to color. | **Pass** |
| A mobile booking sheet | Exact `390x844`; bottom sheet has heading, drag affordance and close control; schedule is dimmed without visual interaction cues; room, office date, selected user-local range and office zone precede fields; title and end-time controls are visible; `10:00 (30 хв)` states the default duration; availability guidance and primary action fit above the viewport edge. | **Pass** |
| B desktop schedule | Exact `1440x900`; seven days and all three workspace regions fit without page-level scrolling; first body row is approximately 200px; at least six hours are visible; free actions, selected slot, own/other bookings, current day and current time are present; the quieter rules do not remove required state labels or compact booking metadata. | **Pass** |
| B mobile schedule | Exact `390x844`; shell, date navigation, room/filter controls and two-item bottom navigation fit; full different-zone identifiers are visible; agenda starts at 296px; the lighter chronological treatment still exposes every booking action and renders each busy span once; state text and icons prevent color-only meaning. | **Pass** |
| B mobile booking sheet | Exact `390x844`; modal sheet, heading and close control are visible; background is de-emphasized; context precedes the form in a clear reading order; the title, 30-minute end time, availability note and primary action are all visible with no clipping; controls visually meet the 44px target. | **Pass** |
| C desktop schedule | Exact `1440x900`; one-row header, three rails, seven days, first body row near 200px and six visible hours satisfy geometry; persistent free actions and all required schedule states remain present; numbered context markers and the selected-path treatment add emphasis without removing timetable information or introducing a wizard interaction. | **Pass** |
| C mobile schedule | Exact `390x844`; top and bottom shell, Today/date controls, room/filter row and both full timezones fit; first agenda row remains at 296px despite the compact path label; free, selected, current, own and occupied states are redundant beyond color; busy spans render once and no horizontal overflow is visible. | **Pass** |
| C mobile booking sheet | Exact `390x844`; sheet heading, close control, selected-context summary, title, default 30-minute end time, guidance and primary action all fit; the background is visibly suppressed; the second path marker is informational rather than a new product step; no prohibited booking feature appears. | **Pass** |

The PNGs establish visual fit only. Native table/list semantics, focus order,
modal inertness, accessible names, actual contrast ratios, forced-colors,
reduced-motion and keyboard behavior still require production browser tests.

## Weighted decision matrix

Scores use the approved `1-5` scale. Each contribution is
`score / 5 * weight`.

| Criterion | Weight | A score | A contribution | A evidence | B score | B contribution | B evidence | C score | C contribution | C evidence |
| --- | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | --- |
| Speed | 20 | 5 | 20 | Strong rails, persistent free-slot labels and direct alignment from room to slot to form minimize search and eye travel. | 4 | 16 | The path stays direct, but low-emphasis dividers and actions take slightly longer to locate in repeated scanning. | 5 | 20 | Repeated selected context and a visible path make the next action unmistakable from schedule through confirmation. |
| Calendar readability | 20 | 5 | 20 | Clear 30-minute rules, stable time gutter, explicit day columns and bounded booking blocks make the seven-day schedule easiest to compare. | 4 | 16 | Typographic hierarchy is strong, but the lighter cell boundaries reduce coordinate certainty in the dense seven-day view. | 4 | 16 | The timetable remains complete, yet numbered markers and selection rails compete slightly with calendar rhythm. |
| Mobile | 15 | 5 | 15 | The fixed time rail, 52px action rows, explicit zone notice and rule-based booking sheet create the clearest compact operational flow. | 5 | 15 | The quiet agenda has excellent reading order, full zone context and the least visual noise while preserving every required action. | 4 | 12 | The active path is clear and still meets the 296px gate, but step labels add cognitive weight to an otherwise direct flow. |
| Accessibility | 15 | 4 | 12 | Visible labels, icons, strong borders and rectangular targets provide robust non-color cues, though dense rules require focus and contrast validation. | 4 | 12 | Open grouping supports scanning and error association, but subtle control boundaries carry more contrast and forced-colors risk. | 4 | 12 | Explicit checks, status text and selection edges reduce ambiguity, while repeated context and continuous accent rails require accessible-name and non-color review. |
| Visual quality | 15 | 4 | 12 | The system is coherent, restrained and purposeful, but its dense line structure is less refined than B's typographic calm. | 5 | 15 | Spacing, typography and selective rules produce the most polished and calm visual composition without becoming editorial. | 4 | 12 | The selected-path treatment is coherent, but numbered badges and broad teal emphasis make the surface busier than the product needs. |
| Product fit | 10 | 5 | 10 | The precise, low-decoration workspace fits frequent B2B scheduling and prioritizes comparison over presentation. | 5 | 10 | The calm ledger character supports long, repeated planning sessions and remains work-focused. | 4 | 8 | The guided emphasis helps occasional booking, but the staged visual language is less neutral for expert repeat use. |
| Implementation risk | 5 | 5 | 5 | The visual model maps directly to approved panes, native table, agenda rows and semantic tokens with few cross-surface dependencies. | 4 | 4 | The component map is direct, but quality depends on finely tuned typography and subtle boundary contrast at every breakpoint. | 3 | 3 | Coordinated path styling across room, date, slot, pane and sheet creates the most state-coupled and regression-prone CSS. |
| **Total** | **100** |  | **94** |  |  | **88** |  |  | **83** |  |

## Decision

**Concept A - Operational Rails wins with 94/100.**

It is the strongest implementation target because the timetable remains the
dominant work surface, the seven-day coordinates are easiest to scan, and the
same structural grammar transfers cleanly to the mobile agenda and booking
sheet. It also has the lowest risk of losing required density, persistent
actions or non-color states during implementation.

Concept B is the most visually refined direction, but its deliberately subtle
boundaries create more risk around rapid slot comparison, control affordance
and non-text contrast. Concept C makes the booking path highly explicit, but
its numbered progression adds a wizard-like signal to a workflow that is
already short and increases styling coordination across responsive surfaces.

No concept was disqualified. The winner is based on the weighted score and the
approved product priorities, not on missing features or unequal states.

## Winner rules for implementation

Implementation must carry forward these Concept A rules:

1. Preserve the flat three-rail desktop composition: `248px` room pane,
   dominant native timetable and `320px` contextual booking pane, separated
   by clear one-pixel structural dividers.
2. Keep the 64px time gutter, aligned day headers, 52px slot rhythm and
   persistent `Plus` plus `Забронювати` or accessible compact equivalent in
   every actionable free slot.
3. Use restrained neutral structure. Teal is limited to selection, focus and
   the primary action; warm tint and an orange line/text marker identify today
   and current time.
4. Make selected, own, occupied and current states redundant through text,
   icon, border or shape. A booking block remains one whole details trigger;
   no nested Cancel enters a narrow timetable cell.
5. Use a leading selected-room rail and explicit check/status without changing
   row geometry.
6. On mobile, use the fixed time rail, chronological 30-minute separators,
   visible text actions and single multi-slot busy blocks. Preserve the exact
   296px different-zone top budget.
7. Build the booking pane and sheet as one reading sequence separated by
   rules, not nested cards: selected context, labelled fields, availability
   guidance and action.
8. Reserve elevation for sheets, popovers and toasts. Static workspace regions
   remain flat.
9. Implement all visual values through the approved semantic tokens rather
   than reproducing prototype literals.

Do not carry forward:

- dense borders around every nested group or field;
- prototype-sized metadata below the specification minimum;
- any current-time label placement that can collide with booking text;
- fixed-width truncation as the only way to expose room, title or timezone
  meaning;
- temporary prototype controls, routes or query parameters.

## Controlled borrowing

Two bounded details may be borrowed without turning the result into a
hybrid-by-committee:

1. From Concept B, use its calmer typographic spacing and selective separators
   inside the booking form only.
2. From Concept C, use one explicit check-and-text confirmation that the room
   and start time are selected inside the booking surface.

Do not borrow B's low-emphasis timetable boundaries, C's numbered step badges,
or C's continuous selected-path rail across the application. Concept A remains
the governing visual grammar.

## Residual risks and prototype limitations

- Static screenshots cannot prove native semantics, focus restoration, inert
  background behavior, live regions, keyboard bounds or screen-reader names.
- Contrast, target size, forced-colors and reduced-motion require measured
  production checks; visual inspection alone is insufficient.
- The comparison covers `1440x900` and `390x844`, not medium, tablet, 320px,
  actual 200% zoom or long-IANA stress fixtures.
- The desktop current-time marker shares a dense 52px row with free-slot
  content. Production layout must reserve space so the label never collides
  with the action at narrower day widths.
- Compact booking metadata is visually tight. Production CSS must enforce the
  approved `13px/16px` title and `12px/16px` metadata minimums.
- Loading, empty, error, conflict, retry, cancellation, notifications, My
  Bookings and auth states were not part of the nine comparison frames.
- The local prototype is disposable visual evidence. Its code must not be
  promoted into production or treated as proof of component architecture.
