**Dashboard changes for review — 10 September 2026**

The work started by replacing outdated test contracts and running them against the existing application. The cssstyle test dependency was updated from 5.3.5 to 5.3.7; its isolated CSS-variable border reproducer now passes. That crash required no form styling change.

The application changes are confined to `src/components/Dashboard.jsx`. The stale-page, cancelled-search, access-response, edit/filter, and map-refresh defects were demonstrated with failing behavioral tests before their fixes. An additional delayed-mutation regression caught an old-query refresh during implementation and drove the shared refresh mechanism described below.

| Issue | Before | Change |
| --- | --- | --- |
| Deletion left server pagination stale | Deleting one of two rows displayed `1 of 2 results`. Deleting the only row on the final page left the list empty instead of navigating back. | Refresh the server page after deletion, including its total. When the requested page exceeds the last remaining page, request the last valid page. |
| Edits left the filtered list stale | Editing a matching warehouse so it no longer matched the search left the row and total on screen. | Refresh server rows and totals after successful edits and visibility changes, using the same mechanism as deletion and immediately promoted creates. Pending submissions do not refresh the live list. |
| An open map retained old markers | Deleting a warehouse updated the list but left its marker until filters or map visibility changed. | Refresh coordinates alongside the list after successful mutations, when the split map is open. The map still requests all matching coordinates, independently of the paginated list. |
| A delayed mutation could refresh an old query | Calling a fetch callback captured when a mutation started could request its old filters after the current query changed. | Successful mutations increment a refresh version. The list/map effects then use the current filters, page, and access state. A delayed deletion test prevents reintroducing the captured-query behavior. |
| A cancelled search reset pagination | On page 2, typing and erasing text within the 300 ms debounce window still reset to page 1 and issued another request. | Start the debounce and reset pagination only when effective filter values differ from the committed query. |
| Responses survived an access change | A request started with dashboard access could complete after access was revoked. Restoring access exposed those old rows while the new request was pending. | Invalidate the request sequence when the fetch effect is cleaned up, including access changes and unmounts. Clear rows, total, loading state, and map coordinates while access/authentication is unavailable. Retry and map calls also honor auth loading. |

Regression tests are in `src/components/__tests__/Dashboard.test.jsx`, under `Dashboard mutation and session regressions`. Seven regression tests were run and failed before their respective fixes; the suite also verifies clearing existing map markers on access loss and successful/failed visibility updates. Tests use the real Dashboard and list/card UI with controlled service responses, including deliberately delayed requests. Map rendering and the separately tested form are mocked boundaries in this suite.

**Test replacement decisions**

- Dashboard tests now use the real auth context with explicit session states, the paginated `list()` contract, server totals, debounce, retry, and response ordering. Its create-confirmation tests distinguish a promoted warehouse from a pending submission receipt.
- WarehouseForm tests now exercise native warehouse-type selects, offered-area inputs, field-specific validation, actual create/edit payloads, coordinate precision, save failures, cancellation, and background contact prefill. Old latitude/longitude range-error expectations were removed because the current form has intentionally removed those checks; no coordinate-validation behavior was changed.
- MobileHeader, MobileNavigation, MobileIntegration, and ResponsiveDataDisplay now run current behavioral tests. The skipped `CompleteMobileIntegration` and `IntegrationVerification` suites were removed because their overlapping header/navigation/view cases are superseded by these suites and the Dashboard tests. Their historical layout/performance claims require browser validation; they are not meaningful assertions about jsdom geometry, and the selected browser checks are not a comprehensive performance audit.
- Warehouse-service error tests now induce real MSW failures. Setup tests verify the provider, API envelope, and computed visibility rather than asserting constants.
- Shared setup preserves computed styles, stubs only missing layout/scroll APIs, and rejects unhandled MSW calls. The CSS dependency update and all shared test/configuration changes are separate from the dashboard behavior changes above.

**Why GitHub Actions failed and what changed**

- `CI Testing` ran Node 18/20 while `.nvmrc` and package engines require Node 22.21.1. The inspected Node 18 run failed loading the coverage provider (`node:inspector/promises`); Node 20 reached the outdated tests and failed there. Both workflows now read `.nvmrc`.
- Dashboard tests omitted auth context and mocked the old `getAll()` array contract. The application now uses `list()` with `{ data, pagination }`. Form tests expected retired controls and messages; cssstyle 5.3.5 also crashed on a valid CSS-variable border followed by a dashed border style. The lockfile now uses cssstyle 5.3.7, verified again with a clean `npm ci`.
- Six suites were entirely skipped. Some service/setup assertions did not exercise the claimed failure behavior. Replacements now execute real interactions or MSW response/error paths.
- `ci.yml` now requires lint, coverage tests, and a production build. `ci-deployment.yml` now runs the same coverage gate before its build and AWS steps; its tests were previously commented out. Deployment still validates its own checkout, so pushes to main intentionally run validation in both workflows.
- Both workflows preserve JUnit/JSON test results and HTML/LCOV/JSON coverage, and publish a job summary even after failure. `reportOnFailure` ensures assertion failures can still produce coverage. The PR-comment action was replaced with the job summary, avoiding PR write permissions. Codecov remains optional; artifact publication is independent of it. The configured LCOV `file` input is supported by the [Codecov v4 action definition](https://github.com/codecov/codecov-action/blob/v4/action.yml).

**Coverage decision to review**

The old `thresholds.global: { ...70 }` object is invalid for this Vitest version: `global` is treated as a file pattern, so those limits did not enforce global coverage. Coverage also omitted production files that no test imported.

The repaired configuration includes all production JS/JSX, excluding test infrastructure, re-export barrels, and `main.jsx` bootstrap. The enforced initial floor is **30% in all four metrics**. This is an explicit baseline for the current whole-source suite, not a claim that the intended 70% whole-project target has been reached. Dashboard has minimums of 70% lines, 65% statements, 60% functions, and 40% branches; WarehouseForm has 70% in every metric. Raise the global floor as tests are added for uncovered features rather than excluding those features from the denominator.

The remaining coverage work includes authentication/refresh flows, staging/review, micro-market editing, and map behavior. The separate mocked-browser checks add interaction coverage but do not contribute to Vitest percentages or prove live backend/AWS integration.

**Remaining dashboard findings**

Table column sorters for ID, type, and rate are client-side comparator functions over the current server page (`Dashboard.jsx`, the `columns` definitions). They do not send sort parameters with the list request. Consequently the visible page is sorted, not the complete matching result set. The backend currently accepts only `createdAt`, `totalSpaceSqft`, and `ratePerSqft` for `sortBy`; a complete fix needs agreed supported columns and coordinated frontend/backend behavior. No sorting behavior was changed in this repair.

The shared `Field` wrapper in `WarehouseForm.jsx` renders a visible label separately from its control without linking them with `htmlFor`/`id` or `aria-labelledby`. This limits accessible naming and label-click focus. The form tests locate these controls through the visible label's field container to exercise the existing form; a follow-up should associate labels with their inputs, including the custom location widgets. No form markup was changed here.

**Validation**

| Check | Result |
| --- | --- |
| Original unit-test baseline | 142 passed, 32 failed, 75 skipped across 25 files |
| Clean dependency installation | `npm ci --no-audit --no-fund` passed on Node 22.21.1; 427 packages installed |
| Full `npm run test:coverage` | **207 passed, 0 failed, 0 skipped**, across **23 files**; approximately 185 seconds |
| Final focused UI recheck | **48 passed** across Dashboard, WarehouseForm, and MobileNavigation after tightening async test cleanup; no React `act` warnings in this run |
| ESLint | `npm run lint` passed |
| Production build | `npm run build` passed; existing large-chunk warnings remain, including the Mapbox chunk |
| Browser regression checks | **18 passed** against the final production preview, using mocked API responses; list loading/pagination, access gating, retries, search/filter requests, card switching, and full filtered map coordinates |
| Workflow/configuration checks | Both YAML files parsed; shared Node version and coverage steps verified; `git diff --check` passed |
| Reports and summary | JUnit, JSON, HTML, LCOV, and coverage-summary files generated; `scripts/test-summary.mjs` printed the correct totals |
| Negative coverage-gate check | A service-only run with a temporary 100% global line threshold passed all 13 tests but exited **1** with global and Dashboard/Form threshold errors, proving both kinds of limits are enforced. Its reports were isolated under `/tmp/`. |

| Coverage scope | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| All production source | 33.68% | 33.33% | 32.02% | 32.65% |
| Dashboard | 89.27% | 87.45% | 84.31% | 56.89% |
| WarehouseForm | 89.72% | 88.64% | 77.77% | 74.52% |

The final global function floor was raised from the provisional 29% to 30% after the added regressions increased coverage. All final global/file limits were checked against the full report. Assertions and asynchronous cleanup in the three touched UI suites were also rechecked separately after removing React `act` warnings from their new tests; production code was unchanged after the successful full run.

The browser run is reproducible from the sibling `Eval_Harness` checkout:

```bash
HARNESS_LIVE_API=0 HARNESS_MODE=preview npm run eval -- \
  evals/dashboard-list.eval.js evals/filters.eval.js \
  evals/dashboard-capability.eval.js evals/views.eval.js --workers=1
```

Its report is `../Eval_Harness/artifacts/20260910-023854/report.html` relative to the frontend repository. This used the existing harness checkout and did not modify its source. The unit-test changes retain existing Ant Design deprecation/compatibility warnings rather than suppressing application warnings globally.

The workflow edits were validated locally before publication. The subsequent [push-readiness recheck](push-readiness-2026-09-10.md) records the fresh full-suite results, complete dashboard browser evaluation, visual-baseline correction, dependency advisories, and GitHub branch-rule inspection. That inspection found no required legacy matrix check names; repository protection settings were not changed.
