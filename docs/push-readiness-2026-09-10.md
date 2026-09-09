# Push readiness recheck — 10 September 2026

Follow-up: the [compatible dependency update audit](dependency-audit-2026-09-10.md) records the subsequent dependency work. The results below describe the original repair before those upgrades.

This recheck validates the frontend working tree based on `43a5b7851d445f9a93dca95e2554e5c5702bcda6`, including the test/CI repairs, Dashboard fixes, and general documentation updates. Validation was performed before committing, pushing, or deploying these changes.

**Result:** all local CI validation commands and the complete dashboard evaluation pass after correcting three stale harness screenshots. The dependency audit remains failing, so this is not an unconditional clean bill of health.

## Fresh validation

| Check | Result |
| --- | --- |
| Runtime | Node 22.21.1, matching `.nvmrc` and both workflows |
| Clean installation | `npm ci` passed; 427 packages installed |
| Lint | `CI=true npm run lint` passed |
| Full unit suite and enforced coverage | `CI=true npm run test:coverage`: **207 passed, 0 failed, 0 skipped**, across 23 files; 188.46 seconds |
| Production build | `CI=true npm run build` passed; existing large-chunk warnings remain |
| GitHub Actions validation | Both workflows passed actionlint 1.7.12, YAML parsing, and shell syntax checks for their 14 `run` blocks |
| Test reports | JUnit, JSON, HTML coverage, LCOV, and coverage summary generated; summary script reports the expected totals |
| Test selection | No focused or skipped unit tests found |
| Dashboard browser evaluation | **93 passed, 0 failed, 0 skipped, 0 flaky**, including all five visual comparisons; retries disabled; 255.43 seconds |
| Final diff/document checks | `git diff --check` passed in both repositories; verification document links and code fences checked |
| Dependency audit | **Not clean**; details below |

| Coverage scope | Lines | Statements | Functions | Branches |
| --- | ---: | ---: | ---: | ---: |
| All production source | 33.68% | 33.33% | 32.02% | 32.65% |
| Dashboard | 89.27% | 87.45% | 84.31% | 56.89% |
| WarehouseForm | 89.72% | 88.64% | 77.77% | 74.52% |

The configured global floor is 30% in all four metrics, with higher Dashboard and WarehouseForm floors. This is not 70% whole-project coverage. The previous 70% configuration did not enforce a global threshold. The [repair review](dashboard-test-repair-review.md) records this decision, the original failures, and the product changes.

## Full dashboard evaluation

The current sibling `Eval_Harness` working tree runs 93 evaluations in the default dashboard project, including GIS and five screenshot comparisons. The first full run (`20260910-030605`) and an additional unchanged rerun (`20260910-031548`) each passed 90 and failed only the same three visual comparisons.

The visual-only run against an exported copy of the **original frontend HEAD** (`20260910-031217`) reproduced the same three failures. Its five rendered views matched the repaired frontend under the existing pixel comparison settings. At raw RGBA precision, the failing card view differed in just three pixels with a maximum channel delta of 1/255; review and mobile were identical. The stale references predated already-committed mobile/card UX work.

Only `baselines/dashboard-cards.png`, `baselines/review-queue.png`, and `baselines/mobile-dashboard.png` were refreshed, using screenshots from the original HEAD reproduction. No visual thresholds or assertions were relaxed. These files and the explanation in `Eval_Harness/docs/visual-baseline-refresh-2026-09-10.md` belong to the **separate harness repository**; a frontend-only commit does not include them.

Final full run `20260910-032713` passed **93/93**, with **5/5 visual matches**, 57 screenshots, zero visual drift, zero new baselines, zero blocked requests, and zero unhandled API endpoints. There were no retries or skipped/flaky tests. Local HTML report: `Eval_Harness/artifacts/20260910-032713/report.html`, relative to the workspace root. Reproduce from `Eval_Harness`:

```bash
CI=true HARNESS_LIVE_API=0 HARNESS_MODE=preview TARGET_URL='' \
  ANTHROPIC_API_KEY='' JUDGE_INLINE=0 UPDATE_BASELINES=0 \
  npm run eval -- --project=dashboard --workers=2 --retries=0
```

This covers the dashboard project's browser scenarios against a fresh local production preview with mocked APIs. It does not validate live backend credentials, production Mapbox connectivity, AWS deployment, the optional paid vision judge, or the separate Android and mobile-audit configurations. The current harness also contains pre-existing local changes, which were preserved.

## Dependency findings

Fresh `npm audit --json` reports **25 affected package entries: 2 critical, 16 high, 6 moderate, and 1 low**. `npm audit --omit=dev --json` reports **8 production package entries: 6 high and 2 moderate**. Both audit commands exit with status 1. Counts are npm package entries, not a count of independent exploitable application paths.

All flagged installed versions were already in the original HEAD lockfile. The repair's cssstyle patch did not introduce them. Production entries are `axios`, `follow-redirects`, `form-data`, `js-cookie`, `nanoid`, `protocol-buffers-schema`, `react-router`, and `react-router-dom`.

The critical entries are the development packages `vitest` and `@vitest/coverage-v8`. The [Vitest critical advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp) describes exposed UI/API server scenarios, rather than the Linux jsdom run used by these workflows. That distinction does not resolve the remaining advisories. The [js-cookie advisory](https://github.com/js-cookie/js-cookie/security/advisories/GHSA-qjx8-664m-686j) also affects an installed direct production dependency.

A dependency update and compatibility check remains necessary before claiming a clean dependency audit. No blanket `npm audit fix` was applied during this verification. The existing workflows do not run `npm audit` as a blocking step; their install, lint, unit/coverage, and build commands passed locally.

The user requested publishing the verified repair first and handling dependency upgrades separately. These audit findings remain open for that follow-up.

## Remaining limits and evidence

- GitHub reports that `main` is not protected, and the branch rules endpoint returned an empty array. No stale matrix job-name requirement was found, and no repository settings were changed.
- GitHub workflow execution and AWS deployment were outside the scope of this local verification. AWS commands were not executed during the recheck.
- Known dashboard limitations remain documented in the repair review: sorting applies to the current server page, and form labels need accessible control associations. The general Mapbox guide also records the mounted map's detail-cache behavior.
- Source fingerprints confirmed that application code, tests, dependencies, and workflow configuration remained unchanged throughout verification. The only subsequent file changes are this report, the repair review's link to it, the three harness PNG references, and the harness baseline explanation.

Local logs are `/tmp/wag-prepush-install.log`, `/tmp/wag-prepush-lint.log`, `/tmp/wag-prepush-coverage.log`, `/tmp/wag-prepush-build.log`, `/tmp/wag-prepush-actionlint.log`, `/tmp/wag-prepush-audit.json`, `/tmp/wag-prepush-audit-production.json`, and `/tmp/wag-prepush-eval-final.log`. Browser artifacts are in the sibling harness's `artifacts/<run-id>/` directories. These generated files are local evidence, not committed documentation assets.
