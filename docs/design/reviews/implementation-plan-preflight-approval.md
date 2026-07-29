# Implementation plan pre-flight approval check

## Scope

- **Reviewed commit:** `fa68e285baa4d68b34d1122fff25e4ac15f76767`
- **Previous review:**
  `docs/design/reviews/implementation-plan-preflight-final.md`
- **Checked findings:** residual P2-4 and New P2-1 only
- **Additional scope:** new breakage only in the amended lines
- **Task count:** 11
- **Verdict:** **REVISE**

The specification, concept decision, previously addressed findings and
unchanged plan sections were not re-reviewed.

## Finding disposition

### Residual P2-4: Complete design-token literal enforcement

**Status: NOT ADDRESSED**

**Current plan refs:** lines 23-26, 159-162, 359-383, 450-493, 580-633 and
2624-2631.

The amended checker now covers the previously named longhand declarations:
grid rows/columns, `flex-basis`, borders, typography and transform lengths. It
also adds thirteen explicit categories, AST parsing, RED fixtures and a closed
structural/focus allowlist.

However, the stated property coverage still omits shorthand declarations that
can contain the same governed literals:

- `animation` and `animation-delay` can contain duration literals, while line
  604 checks only `transition*` and `animation-duration`;
- `font` can contain both `font-size` and `line-height`;
- `grid-template` or `grid` can contain track lengths;
- `flex` can contain a `flex-basis` length.

This is a real false-green path. The current source already contains
`animation: spin 0.8s linear infinite` in `src/app/globals.css` at lines 790,
960 and 1050. Task 1 moves the spinner family into `ui.css`, but the specified
checker does not classify the `0.8s` value in the `animation` shorthand.
Consequently, the Task 11 `--include-legacy` gate can report zero violations
while a hardcoded duration remains outside `tokens.css`.

**Required correction:** add shorthand-aware AST classification and RED
fixtures for at least:

```css
.spinner { animation: spin 0.8s linear infinite; }
.delayed { animation-delay: 180ms; }
.meta { font: 500 13px/18px var(--font-sans); }
.workspace { grid-template: "rail main" 56px / 248px 1fr; }
.rail { flex: 0 0 248px; }
```

The fixtures must produce `duration`, `font-size`/`line-height`,
`grid-track` and `flex-basis` violations respectively. Add the corresponding
shorthand properties to the Task 1 parser contract and Task 11 thirteen-
category zero-legacy test.

### New P2-1: Task 1 manifest build verification

**Status: ADDRESSED**

**Current plan refs:** global lines 178-182; Task 1 lines 639-672 and 686-690;
execution protocol lines 2814-2823.

Task 1 now runs `npm run build` and `git diff --check` after the focused token
check and before typecheck/lint/source hygiene and commit. Its expected result
explicitly requires successful Next/PostCSS compilation and zero whitespace
errors. The global manifest rule, Task 1 command block and execution protocol
are consistent, so the previous task conflict is removed.

## New breakage

No additional P0-P2 breakage was found in the lines changed for New P2-1.
The shorthand bypass described above is the remaining incompleteness of P2-4,
not a separate task conflict.

## Final gate

| Priority | Residual count |
| --- | ---: |
| P0 | 0 |
| P1 | 0 |
| P2 | 1 |
| P3 | 0 |
| Task conflicts | 0 |

The plan still has exactly 11 ordered tasks and no circular dependency.
However, approval requires P0-P2 to equal zero as well as zero task conflicts.
Because one P2 remains, the verdict is **REVISE**, and the 11 tasks cannot yet
be certified executable sequentially under SDD.

A final verification limited to shorthand enforcement is sufficient after the
P2-4 correction.
