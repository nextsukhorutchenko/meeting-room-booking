# Implementation plan pre-flight approval

## Scope

- **Reviewed commit:** `3e795063e22896567153f49829be98edd4d7c2e8`
- **Previous review:**
  `docs/design/reviews/implementation-plan-preflight-approval.md`
- **Checked finding:** residual P2-4 only
- **Additional scope:** new breakage only in the lines changed by the reviewed
  commit
- **Task count:** 11
- **Verdict:** **APPROVED**

The specification, concept decision, previously addressed findings and
unchanged plan sections were not re-reviewed.

## Finding disposition

### Residual P2-4: Complete design-token shorthand enforcement

**Status: ADDRESSED**

**Current plan refs:** lines 23-26, 473-494, 617-644 and 2660-2671.

The amended Task 1 RED fixtures now cover every shorthand path named by the
previous review:

- `animation` and `animation-delay` produce `duration`;
- `font` produces `font-size` and `line-height`;
- `grid-template` covers the `grid-template`/`grid` classifier and produces
  `grid-track`;
- `flex` produces `flex-basis`.

The parser contract uses property-specific CSS value AST classification for
those shorthand declarations. It defines which tokens are classified, which
unitless values or area strings are ignored, and limits duplicate findings to
one per declaration/category. This closes the false-green path for existing
values such as `animation: spin 0.8s linear infinite`.

Task 11 now explicitly requires all five shorthand paths, their exact expected
categories, and a zero-violation `--include-legacy` result. The RED fixtures,
parser contract and final gate therefore enforce the same thirteen-category
token policy.

## New breakage

None found in the lines changed by
`3e795063e22896567153f49829be98edd4d7c2e8`.

The added fixtures match the declared classifier signatures and expected
category order. The Task 11 assertions use the same property and category
vocabulary, so the correction introduces no undefined interface, dependency
cycle or task conflict.

## Final gate

| Priority | Residual count |
| --- | ---: |
| P0 | 0 |
| P1 | 0 |
| P2 | 0 |
| P3 | 0 |
| Task conflicts | 0 |

The plan contains exactly 11 ordered tasks. Their dependencies remain acyclic,
and each task retains its own RED/GREEN verification and task-scoped review
boundary. A fresh implementer can execute the tasks sequentially under SDD.

## Verdict

**APPROVED.** The approval gate is satisfied: P0-P2 residual counts are zero,
task conflicts are zero, and all 11 tasks are executable sequentially under
Subagent-Driven Development.
