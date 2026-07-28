# Clickable Booking History Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every non-cancel area of a booking-history row open and
highlight that booking in the schedule with native pointer and keyboard
behavior.

**Architecture:** Replace the title-only link with one semantic Next.js
`Link` that owns the row's main area, including its status. Keep `Cancel` as
the link's sibling and make the button itself own the complete action area.
Use CSS flex layout on desktop and an intentional two-column grid on mobile;
do not add row click handlers, event suppression, overlays, or manual keyboard
handling.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, CSS, Testing
Library, Vitest, Playwright.

## Global Constraints

- Keep `bookingUrl(booking, officeTimeZone)` as the only deep-link generator.
- The link and `Cancel` must be sibling controls with non-overlapping hit
  targets.
- Do not use `onClick` on `<li>`, `role="link"`, `stopPropagation`, overlays,
  or `z-index`.
- `Tab` must focus the link before `Cancel`; native `Enter` and `Space`
  behavior must remain authoritative.
- Desktop keeps its current visible arrangement.
- Mobile changes to a two-column main/action layout: the link fills the main
  column and the `Cancel` button itself fills the action column.
- Every point in the row must belong to either the link or `Cancel`; no
  non-interactive wrapper may create dead pointer space.
- Do not add dependencies or alter booking, cancellation, pagination, or
  routing contracts.
- Use only an isolated database whose name ends in `_test` for integration or
  E2E verification. Never reset a production database.

---

### Task 1: Accessible Full-Row Booking Links

**Files:**
- Modify: `tests/unit/booking-list.test.tsx`
- Modify: `src/components/bookings/booking-list.tsx`
- Modify: `src/app/globals.css`
- Modify: `e2e/my-bookings.spec.ts`

**Interfaces:**
- Consumes:
  `bookingUrl(booking: BookingListItem, officeTimeZone: string): string`.
- Produces: `.booking-list-row-link`, `.booking-list-title`, and
  `.booking-list-cancel-visual` as stable DOM/CSS hooks.
- Produces: link accessible name
  `Open ${booking.title} in schedule`.
- Preserves: `data-booking-id`, `.booking-list-row`,
  `.booking-list-content`, `.booking-list-details`, `.booking-status`, and
  `.booking-list-cancel`.

- [ ] **Step 1: Extend the component regression test before implementation**

Replace the existing
`links a row to its office week and booking highlight` test in
`tests/unit/booking-list.test.tsx` with a test that verifies the complete
semantic contract:

```tsx
it('renders the row link before a separate cancel control', async () => {
  const linked = booking('linked-booking', {title: 'Roadmap review'});
  fetchMock.mockImplementation((input: RequestInfo | URL) => {
    const scope = requestUrl(input).searchParams.get('scope');
    return Promise.resolve(response({
      items: scope === 'future' ? [linked] : [],
      nextCursor: null,
    }));
  });

  renderBookingList();
  const user = userEvent.setup();
  const link = await screen.findByRole('link', {
    name: 'Open Roadmap review in schedule',
  });
  const cancel = screen.getByRole('button', {
    name: 'Cancel Roadmap review',
  });
  const row = link.closest('li');

  expect(row).not.toBeNull();
  expect(link).toHaveAttribute(
    'href',
    '/schedule?roomId=oak&weekStart=2026-08-03&day=2026-08-04' +
      '&bookingId=linked-booking',
  );
  expect(link).toContainElement(screen.getByText('Roadmap review'));
  expect(link).toContainElement(screen.getByText('Oak'));
  expect(link).toContainElement(screen.getByText('Upcoming'));
  expect(link.parentElement).toBe(row);
  expect(cancel.parentElement).toBe(row);
  expect(
    link.compareDocumentPosition(cancel) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  await user.tab();
  expect(link).toHaveFocus();
  await user.tab();
  expect(cancel).toHaveFocus();
});
```

Keep the existing cancellation test. After opening its dialog, add an
assertion that the link remains outside the dialog and the row is still
present until cancellation is confirmed.

- [ ] **Step 2: Extend E2E acceptance assertions before implementation**

In
`@booking a history row opens and highlights the correct schedule booking`,
replace the title-only click with a click on the status, then repeat the flow
with keyboard activation:

```ts
const row = page.locator(`[data-booking-id="${id}"]`);
await row.getByText('Upcoming', {exact: true}).click();

const expectedUrl =
  `/schedule?roomId=${room.id}&weekStart=${weekStart}` +
  `&day=${startsAt.toISODate()}&bookingId=${id}`;
await expect(page).toHaveURL(expectedUrl);
await expect(page.getByRole('article', {name: new RegExp(title)}))
  .toHaveAttribute('data-highlighted', 'true');

await page.goBack();
await expect(page).toHaveURL('/my-bookings');
const rowLink = page.getByRole('link', {
  name: `Open ${title} in schedule`,
});
await rowLink.focus();
await expect(rowLink).toBeFocused();
await page.keyboard.press('Enter');
await expect(page).toHaveURL(expectedUrl);
```

In
`@booking a future history row cancels through the shared dialog`, immediately
after clicking `Cancel`, assert:

```ts
await expect(page).toHaveURL('/my-bookings');
await expect(
  page.getByRole('dialog', {name: 'Cancel booking'}),
).toBeVisible();
```

Update the mobile layout probe in the pagination test:

```ts
const layout = await page.evaluate(() => ({
  horizontalOverflow:
    document.documentElement.scrollWidth -
    document.documentElement.clientWidth,
  rowsContained: Array.from(
    document.querySelectorAll<HTMLElement>('.booking-list-row'),
  ).every((row) => {
    const rect = row.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= window.innerWidth + 0.5;
  }),
  titlesContained: Array.from(
    document.querySelectorAll<HTMLElement>('.booking-list-title'),
  ).every((title) => title.scrollWidth <= title.clientWidth + 1),
  hitTargetsCoverRows: Array.from(
    document.querySelectorAll<HTMLElement>('.booking-list-row'),
  ).every((row) => {
    const link = row.querySelector<HTMLElement>('.booking-list-row-link');
    const cancel =
      row.querySelector<HTMLElement>('.booking-list-cancel');
    if (!link) {
      return false;
    }
    const rowRect = row.getBoundingClientRect();
    const linkRect = link.getBoundingClientRect();
    const fillsHeight =
      Math.abs(linkRect.top - rowRect.top) <= 1 &&
      Math.abs(linkRect.bottom - rowRect.bottom) <= 1;
    if (!cancel) {
      return fillsHeight &&
        Math.abs(linkRect.width - rowRect.width) <= 1;
    }
    const cancelRect = cancel.getBoundingClientRect();
    return fillsHeight &&
      Math.abs(cancelRect.top - rowRect.top) <= 1 &&
      Math.abs(cancelRect.bottom - rowRect.bottom) <= 1 &&
      Math.abs(linkRect.right - cancelRect.left) <= 1 &&
      Math.abs(
        linkRect.width + cancelRect.width - rowRect.width,
      ) <= 1;
  }),
}));
```

Expect `hitTargetsCoverRows: true` together with the existing containment
assertions.

- [ ] **Step 3: Run the focused unit test to verify the red state**

Run:

```bash
npx vitest run tests/unit/booking-list.test.tsx
```

Expected: FAIL because the current link is named only `Roadmap review`, does
not contain the status, and is nested inside `.booking-list-details` instead
of being the cancel button's sibling.

- [ ] **Step 4: Replace the title-only link with the row-area link**

In `BookingSection`, keep the `<li>` and create the sibling controls in this
order:

```tsx
<li
  className="booking-list-row"
  data-booking-id={booking.id}
  key={booking.id}
>
  <Link
    aria-label={`Open ${booking.title} in schedule`}
    className="booking-list-row-link"
    href={bookingUrl(booking, officeTimeZone)}
  >
    <div className="booking-list-content">
      <time dateTime={booking.startsAt}>
        <strong>{time.date}</strong>
        <span>{time.time}</span>
      </time>
      <div className="booking-list-details">
        <strong className="booking-list-title">{booking.title}</strong>
        <span>{booking.room.name}</span>
      </div>
    </div>
    <span
      className={`booking-status booking-status-${booking.status}`}
    >
      {statusLabel(booking.status)}
    </span>
  </Link>
  {onCancel && booking.status === 'upcoming' ? (
    <button
      aria-label={`Cancel ${booking.title}`}
      className="booking-list-cancel"
      onClick={() => onCancel({
        id: booking.id,
        title: booking.title,
      })}
      title="Cancel booking"
      type="button"
    >
      <span aria-hidden="true" className="booking-list-cancel-visual">
        <CalendarX2 />
      </span>
    </button>
  ) : null}
</li>
```

Delete `.booking-list-actions` markup. Do not add event handlers to the row or
link beyond native `Link` behavior.

- [ ] **Step 5: Implement non-overlapping desktop and mobile hit areas**

Replace the current row/content/action/title/cancel CSS with equivalent rules
using these responsibilities:

```css
.booking-list-row {
  display: flex;
  align-items: stretch;
  min-width: 0;
}

.booking-list-row-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  gap: 1.25rem;
  min-width: 0;
  border-bottom: 1px solid #e2e7e3;
  padding: 0.9rem 0.65rem 0.9rem 0;
  color: inherit;
  text-decoration: none;
}

.booking-list-row-link:hover {
  background: #f7faf7;
}

.booking-list-row-link:hover .booking-list-title {
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.18rem;
}

.booking-list-row-link:focus-visible {
  outline: 2px solid #2f7652;
  outline-offset: -2px;
}

.booking-list-title {
  overflow: hidden;
  color: #184f35;
  font-size: 0.875rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}

.booking-list-cancel {
  display: flex;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 2.25rem;
  border: 0;
  border-bottom: 1px solid #e2e7e3;
  background: transparent;
  padding: 0;
  color: #5a685f;
}

.booking-list-cancel-visual {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border: 1px solid #bac4bd;
  border-radius: 0.375rem;
  background: #ffffff;
}
```

Move existing cancel hover colors to
`.booking-list-cancel:hover .booking-list-cancel-visual`. Add a visible
`:focus-visible` outline to `.booking-list-cancel` and keep the icon at
`1rem`.

Within `@media (max-width: 48rem)`, replace the stacked row/action rules with:

```css
.booking-list-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 3rem;
  align-items: stretch;
  gap: 0;
}

.booking-list-row-link {
  align-items: flex-start;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.9rem 0.65rem 0.9rem 0;
}

.booking-list-content {
  grid-template-columns: 1fr;
  width: 100%;
  gap: 0.6rem;
}

.booking-status {
  align-self: flex-start;
}
```

Rows without `Cancel` must not retain an empty action column. Add the
cancellable modifier class directly to the list item:

```tsx
className={
  onCancel && booking.status === 'upcoming' ?
    'booking-list-row booking-list-row-cancellable' :
    'booking-list-row'
}
```

with:

```css
.booking-list-row {
  grid-template-columns: minmax(0, 1fr);
}

.booking-list-row-cancellable {
  grid-template-columns: minmax(0, 1fr) 3rem;
}

.booking-list-cancel {
  width: 3rem;
}
```

Use these exact class-based rules. Do not use `:has()` so the layout does not
depend on selector support.

- [ ] **Step 6: Run component tests and complete the green phase**

Run:

```bash
npx vitest run tests/unit/booking-list.test.tsx
```

Expected: all `BookingList` tests PASS. Confirm the test proves DOM sibling
order and native tab order rather than checking implementation-only classes.

- [ ] **Step 7: Run the targeted browser acceptance tests**

With the isolated `_test` database configured, run:

```bash
npm run test:e2e -- --grep "history row|future history row"
```

Expected: the pointer, keyboard, highlighting, and cancel-isolation flows
PASS. Inspect the mobile screenshot generated by the pagination test and
confirm the link/action columns are contained, aligned, and non-overlapping.

- [ ] **Step 8: Run the complete verification gate**

Run:

```bash
npm run lint
npm run typecheck
npm run check:source
npm run test:unit
npm run test:integration
npm run build
npm run test:e2e
```

Expected: lint, typecheck, source hygiene, all unit and integration tests,
build, and all 41 E2E tests PASS. Review `git diff --check` and verify that
only the four implementation/test files plus this already committed
documentation are in scope.

- [ ] **Step 9: Request task-scoped review and fix blocking findings**

Give a fresh reviewer the design spec, this plan, the task diff, and the
verification results. Require findings-first review of accessibility, DOM
semantics, hit-target geometry, responsive containment, and regression
coverage. Fix every blocking finding and repeat the affected checks.

- [ ] **Step 10: Commit the implementation**

```bash
git add src/components/bookings/booking-list.tsx \
  src/app/globals.css \
  tests/unit/booking-list.test.tsx \
  e2e/my-bookings.spec.ts
git commit -m "feat: make booking history rows clickable"
```
