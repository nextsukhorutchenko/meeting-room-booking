# Google Stitch prompt for Roomwork concept exploration

## Purpose and handling

This artifact is a sanitized visual-design prompt. It contains no source code,
credentials, secrets, private URLs, real user data, or production identifiers.
All people, rooms, meetings, and dates in the prompt are fictional.

Google Stitch output is visual exploration only. Generated layouts and any
generated frontend code are not production artifacts and must not be copied
into the application without independent semantic, accessibility, responsive,
security, and implementation review.

## Sanitized prompt

> Design a high-fidelity visual exploration for **Roomwork**, a fictional
> internal B2B web application for booking meeting rooms. The visible UI must
> be in Ukrainian. Use `Roomwork` as the product name and
> `Бронювання переговорних` as its descriptor.
>
> Produce **EXACTLY THREE distinct concept directions**, labelled:
>
> - **A - Operational Rails**
> - **B - Quiet Ledger**
> - **C - Focused Flow**
>
> Do not produce a fourth direction, alternate theme, landing page, dashboard,
> or admin template.
>
> For **each** concept, produce exactly these three frames:
>
> 1. Desktop schedule at **1440 x 900**.
> 2. Mobile schedule at **390 x 844**.
> 3. Mobile booking sheet or full-screen booking flow at **390 x 844**.
>
> The result must therefore contain exactly **nine primary frames**.
>
> ## Product character
>
> The visual tone is calm productivity: clear, quiet, operational, and
> trustworthy. It should feel like a polished scheduling tool used repeatedly
> during a workday. Prioritize fast scanning, calendar readability, obvious
> actions, and stable geometry.
>
> Avoid:
>
> - marketing or landing-page composition;
> - admin-dashboard cards and KPI widgets;
> - card-inside-card layouts;
> - oversized hero text;
> - gradients, glassmorphism, neon, purple-blue AI styling, glowing effects,
>   decorative blobs, or bokeh;
> - excessive rounded containers or pill-shaped controls;
> - dark mode;
> - stock photography, illustrations, or decorative charts;
> - hover-only actions;
> - tiny calendar text;
> - mobile layouts that shrink the seven-day table.
>
> ## Shared visual system
>
> Use a light neutral foundation with white functional surfaces, dark neutral
> text, deep teal primary actions, blue informational states, green ownership
> and success states, orange current-time context, and red conflict or error
> states. Anchor the exploration to this semantic palette:
> canvas `#F7F8FA`, surface `#FFFFFF`, primary text `#17202A`, muted text
> `#475569`, brand `#0F766E`, brand-soft `#CCFBF1`, information
> `#1D4ED8` on `#EFF6FF`, ownership `#14532D` on `#ECFDF5`, current context
> `#9A3412` on `#FFF7ED`, and danger `#B42318` on `#FFF1F2`. Do not reduce text
> contrast with opacity. Keep static panes flat with borders and dividers rather
> than floating shadows. Reserve subtle elevation for popovers and modal
> sheets.
>
> Use a system sans-serif type style similar to Segoe UI. Use zero letter
> spacing. Use a clear hierarchy approximately equivalent to:
>
> - desktop page title: 28 px;
> - compact page title: 20 px;
> - section heading: 20 px;
> - body and form text: 16 px;
> - control labels: 14 px;
> - timetable title: 13 px minimum;
> - timetable metadata: 12 px minimum.
>
> Use an 8 px spacing rhythm. Use 4 px radii for compact status labels, 8 px
> radii for controls and functional panels, and 12 px top corners only for a
> modal bottom sheet. Do not make page sections look like floating cards.
>
> ## Immutable product behavior
>
> The concepts may change visual grammar, emphasis, density, and grouping, but
> must not change these functional requirements:
>
> - Primary navigation has exactly two destinations:
>   `Розклад` and `Мої бронювання`.
> - Use Monday as the first day of the week and a 24-hour time format.
> - Utilities are notification bell and account menu. `Вийти` is inside the
>   account menu.
> - Rooms expose name, floor, and capacity. A minimum-capacity filter exists.
> - The office schedule uses 30-minute slots and office hours 09:00-19:00.
> - Dates are office dates. Actionable time labels use the browser timezone.
> - If browser and office timezones differ, show both full timezone identifiers
>   in visible text. Do not hide timezone meaning in a tooltip.
> - A booking title is 1-100 characters.
> - Duration is 30-240 minutes in 30-minute increments.
> - Default duration is 30 minutes.
> - Booking end time cannot pass the next booking, office closing time, or four
>   hours after the selected start.
> - Adjacent bookings are valid because intervals are half-open.
> - Available, selected, own, occupied, current-time, and conflict states use
>   text, icon, border, or shape in addition to color.
> - An available slot has a visible booking affordance before hover.
> - Selecting a free start opens a booking composer with room, date, and start
>   already filled.
> - The baseline booking path is: select free start, enter title, activate
>   `Забронювати`.
> - A booking conflict keeps the draft, refreshes the schedule, recalculates
>   available end times, and offers a retry.
> - Only the owner can cancel an upcoming booking, and cancellation requires
>   confirmation.
> - Do not add editing, rescheduling, recurring bookings, drag-and-drop, room
>   administration, analytics, profile management, or new notification
>   channels.
>
> ## Desktop frame requirements - 1440 x 900
>
> Show the authenticated schedule as a real working screen, not a presentation
> board.
>
> - A sticky 64 px single-row app header.
> - Left supporting room pane, 248 px.
> - Central seven-day native timetable, visually dominant.
> - Right contextual booking pane, 320 px.
> - The timetable must fit all seven days without page-level horizontal
>   scrolling.
> - Keep `schedule-scrollport.top <= 152 px` and
>   `schedule-body-first-row.top <= 208 px`.
> - The timetable has a 64 px sticky time gutter, a 56 px sticky day header,
>   and 52 px rows.
> - At least six working hours are fully visible in the first viewport.
> - The room pane contains `Переговорні`, a labelled
>   `Мінімальна місткість` control, `Скинути` only when active, and a flat room
>   list with selected-room treatment.
> - The top schedule controls include previous week, visible `Сьогодні`, next
>   week, and the visible date range.
> - The central summary visibly names room, floor, capacity, and timezone.
> - The contextual pane remains visible when closed and shows
>   `Деталі бронювання` plus
>   `Оберіть вільний час у розкладі`.
> - Show one selected free slot, one own booking, one other booking, the current
>   day, and the current-time line.
> - A 30-minute booking block must still expose a readable title, time range,
>   and visible `Ваше` or `Зайнято` status.
> - The whole booking block opens details. Do not put a nested Cancel button
>   inside the narrow seven-day block.
>
> Use fictional content only, for example:
>
> - rooms `Клен`, `Дніпро`, and `Обрій`;
> - meetings `Планування спринту`, `Огляд макетів`, and `Командна синхронізація`;
> - generic account label `ІК`.
>
> ## Mobile schedule frame requirements - 390 x 844
>
> Show the same product as a mobile work surface, not a compressed desktop
> grid.
>
> - A 56 px top app bar with `Roomwork`, notification bell, and account menu.
> - A fixed 56 px safe-area-aware bottom navigation with exactly
>   `Розклад` and `Мої бронювання`.
> - A compact title row with `Бронювання переговорних` and a visible 44 px
>   `Сьогодні` button.
> - A 52 px date-navigation row with previous, date strip, and next controls.
> - A room/action row with room name, floor, capacity, and a separate 44 px
>   `Фільтри` control.
> - When timezones differ, add a separate visible two-line timezone notice:
>   `Ваш час: Europe/Berlin` and
>   `Офіс: 09:00-19:00 Europe/Kyiv`.
> - The schedule is a one-day chronological agenda list, not a grid.
> - Each free 30-minute row shows time and visible text action
>   `Забронювати`.
> - A busy multi-slot booking renders once with its full time range.
> - Show own, occupied, current, and available states without color-only
>   meaning.
> - Keep the first agenda body item no lower than 296 px from the viewport top
>   in the different-timezone case.
> - Do not allow page-level horizontal overflow.
>
> ## Mobile booking frame requirements - 390 x 844
>
> Show the booking flow opened from a free mobile agenda row.
>
> - Use a modal bottom sheet up to 88% of viewport height; use a full-screen
>   sheet when content or keyboard height requires it.
> - Provide a visible heading `Нове бронювання` and a familiar close icon with
>   accessible meaning.
> - Show the selected room, office date, browser-local start time, and timezone
>   context before the editable fields.
> - Include a visible `Назва` field and an `Час завершення` or duration choice.
> - Select the first valid 30-minute end time by default.
> - Show options up to four hours, bounded by office close and the next booking.
> - Primary action is `Забронювати`.
> - Keep a 44 px minimum product target for controls.
> - Keep field labels, errors, and primary action visible and operable when the
>   on-screen keyboard is present.
> - Include a compact, understandable example of validation or availability
>   guidance without turning the frame into an error-only state.
> - The background schedule is visually de-emphasized and conceptually inert.
>
> ## Accessibility requirements
>
> Design for WCAG 2.2 AA and treat accessibility as a release constraint:
>
> - normal text contrast at least 4.5:1;
> - meaningful graphics and control boundaries at least 3:1;
> - visible focus treatment with inner and outer separation;
> - product target of at least 44 x 44 CSS px for standalone controls;
> - no action or status communicated by color alone;
> - no clipping or overlap at 320 CSS px or 200% zoom;
> - labels wrap rather than disappear;
> - native table semantics for multi-day schedule and chronological list
>   semantics for mobile;
> - no partial ARIA grid behavior;
> - reduced-motion-compatible states;
> - state boundaries that remain understandable in forced-colors mode.
>
> ## Required distinction between the three concepts
>
> Keep all behavior and geometry above, but make the visual directions
> unmistakably different:
>
> - **A - Operational Rails:** strongest structural rails and dividers, highest
>   useful information density, crisp operational hierarchy.
> - **B - Quiet Ledger:** typography-led, open ledger treatment, calmer line
>   work, more breathing room inside the same geometry.
> - **C - Focused Flow:** stronger active-task path from selected room to
>   selected slot to booking composer, with restrained brand-soft emphasis.
>
> For every direction, show realistic settled UI and coherent component states.
> Do not change the feature set to make one direction look more attractive.
> Do not treat generated frontend code as implementation-ready. The output is
> for screenshot comparison and weighted design selection only.

## Expected output check

The exploration is complete only when it contains:

- three and only three concept directions;
- three primary frames for each direction;
- nine primary frames total;
- no code, secrets, credentials, real URLs, or real user data;
- no added product functionality;
- visible differences in visual grammar rather than different feature sets.
