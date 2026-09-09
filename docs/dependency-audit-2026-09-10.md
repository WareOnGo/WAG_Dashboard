# Compatible dependency updates — 10 September 2026

Starting commit: `7115fe6247e5eaf7acb4cd4cd32125d28b51b112`. Its [CI Testing run](https://github.com/WareOnGo/WAG_Dashboard/actions/runs/34414155067) and [CI + Deployment run](https://github.com/WareOnGo/WAG_Dashboard/actions/runs/34414154801) both succeeded before this update pass.

## Audit and update scope

The project declares 25 direct dependencies. A fresh `npm outdated --json` found 23 with newer releases, of which **21 have updates inside the existing declared ranges**: seven production dependencies and fourteen development dependencies. All 21 resolved and installed with strict peer-dependency checks, then passed the existing unit and dashboard browser suites. No package declarations, direct dependency major versions, application code, test expectations, or coverage thresholds were changed.

These 21 direct updates are distinct from the 25 affected package entries in the security audit, which also included transitive dependencies.

| Security audit | Before | After compatible updates |
| --- | ---: | ---: |
| Critical | 2 | 0 |
| High | 16 | 0 |
| Moderate | 6 | 0 |
| Low | 1 | 0 |
| Total affected package entries | **25** | **0** |
| Production-only affected entries | **8** | **0** |

The fresh full and production-only audits both exit successfully. This reports known npm advisories at the time of the check; it is not a complete application security assessment.

## Direct version changes

| Package | Previous | Updated | Use |
| --- | --- | --- | --- |
| `antd` | 5.27.6 | 5.29.3 | Production |
| `axios` | 1.12.2 | 1.20.0 | Production |
| `js-cookie` | 3.0.5 | 3.0.8 | Production |
| `mapbox-gl` | 3.20.0 | 3.30.0 | Production |
| `react` | 19.2.0 | 19.3.0 | Production |
| `react-dom` | 19.2.0 | 19.3.0 | Production |
| `react-router-dom` | 7.9.4 | 7.18.3 | Production |
| `@eslint/js` | 9.38.0 | 9.39.5 | Development |
| `@testing-library/react` | 16.3.1 | 16.3.3 | Development |
| `@testing-library/user-event` | 14.6.1 | 14.6.7 | Development |
| `@types/react` | 19.2.2 | 19.3.0 | Development |
| `@types/react-dom` | 19.2.2 | 19.3.0 | Development |
| `@vitejs/plugin-react` | 5.0.4 | 5.2.0 | Development |
| `@vitest/coverage-v8` | 4.0.16 | 4.1.11 | Development |
| `eslint` | 9.38.0 | 9.39.5 | Development |
| `eslint-plugin-react-refresh` | 0.4.24 | 0.4.26 | Development |
| `globals` | 16.4.0 | 16.5.0 | Development |
| `jsdom` | 27.3.0 | 27.4.0 | Development |
| `msw` | 2.12.4 | 2.15.0 | Development |
| `vite` | 7.1.11 | 7.3.6 | Development |
| `vitest` | 4.0.16 | 4.1.11 | Development |

Including transitive dependencies, 204 existing lockfile package paths changed version, 20 paths were added, and 34 were removed. These are lockfile locations, including any nested copies, rather than counts of independent libraries.

`@testing-library/jest-dom` stays at 6.9.1 and `eslint-plugin-react-hooks` stays at 5.2.0: their available updates require changing the declared ranges. Other newer versions outside the current ranges, such as Ant Design 6, ESLint 10, Vite 8, and Vitest 5, remain for a separate migration. npm emits an ESLint 9 support warning; the security audit is nevertheless clear. The unused `js-cookie` dependency was updated automatically in this pass; removing it can be a separate cleanup.

## Resolver and installation checks

`npm update` respects the dependency ranges in `package.json`, as described in the [npm update documentation](https://docs.npmjs.com/cli/v10/commands/npm-update/). The candidate lockfile was generated in a temporary copy, with `--strict-peer-deps` enabled and no `--force`, `--legacy-peer-deps`, or overrides.

Both npm 10.9.4 and 10.9.9 crashed internally with `Cannot read properties of null (reading 'edgesOut')` while resolving the bulk update. A temporary npm 11.19.1 invocation completed successfully:

```bash
npm exec --yes --package=npm@11.19.1 -- npm update \
  --package-lock-only --ignore-scripts --strict-peer-deps
```

Only the resulting lockfile was copied into the frontend checkout. The root dependency declarations were checked for equality, and every direct resolved version was checked against its existing range. System npm and the workflows were not upgraded.

The normal project toolchain, Node 22.21.1 with npm 10.9.4, then passed `npm ci --strict-peer-deps --engine-strict`, installing 409 packages. `npm ls --all` exited successfully with no dependency-tree problems. Thus the npm 10 resolution crash did not prevent clean installation of the resolved lockfile with the existing CI toolchain.

## Validation

| Check | Result |
| --- | --- |
| Clean install with strict peer/engine checks | Passed |
| Dependency tree | Passed; no reported problems |
| Full security audit | Passed; zero affected entries |
| Production-only security audit | Passed; zero affected entries |
| Lint | Passed |
| Unit tests and coverage | Passed: 207 tests across 23 files, zero failures/skips, 239.27 seconds; existing coverage thresholds satisfied |
| Production build | Passed; Vite 7.3.6, 20.30 seconds; existing large-chunk warnings remain |
| Dashboard browser evaluations | Passed: 93 tests, zero failures/skips/flaky tests, retries disabled; all five visual comparisons matched; 276.25 seconds |
| GitHub CI for this update | Run through the dependency pull request after publication; see its checks for the remote result |

The dependency-update branch runs GitHub CI through a draft pull request. The deployment workflow runs on pushes to `main`; this update is validated separately before merging.

Global coverage after the tool updates is 33.68% lines, 33.31% statements, 32.02% functions, and 32.65% branches. Dashboard and WarehouseForm coverage are unchanged from the repair recheck. JUnit, JSON, HTML coverage, LCOV, and the validation summary were generated successfully.

Browser run `20260910-043804` produced 57 screenshots with zero visual drift, zero new baselines, zero blocked requests, and zero unhandled API endpoints. The existing harness references and comparison settings were retained. The local HTML report is `Eval_Harness/artifacts/20260910-043804/report.html`, relative to the workspace root. This uses mocked APIs and a production preview; the optional vision judge, live backend integrations, and separate Android/mobile-audit configurations were not part of the run.

Frontend source fingerprints were checked throughout validation. Only this report changed after checks started; application code, dependency versions, test/configuration files, and harness baselines remained unchanged.
