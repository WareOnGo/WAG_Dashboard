# WAG Dashboard — Internal Frontend

The internal WareOnGo dashboard: browse and edit the warehouse master list, review
inbound submissions before they go live, draw micro-market polygons, log site visits, and
generate client-facing PPTs and visit itineraries.

- **Stack:** React 19, Vite 7, Ant Design 5 (dark), React Router 7, Mapbox GL 3, axios
- **Auth:** Google OAuth via the backend, JWT in `localStorage`
- **Backend:** [`Dashboard_Backend`](https://github.com/WareOnGo/Dashboard_Backend) — this app is a pure client, it holds no business rules of its own
- **Deploy:** GitHub Actions → S3 → CloudFront (static SPA)

---

## Table of contents

- [Architecture](#architecture)
- [Key design decisions](#key-design-decisions)
- [Authentication](#authentication)
- [Data flow](#data-flow)
- [Project layout](#project-layout)
- [Features](#features)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Testing](#testing)
- [Deployment](#deployment)
- [Gotchas](#gotchas)

---

## Architecture

A layered SPA. Components never call axios directly, and services never touch React state.

```
      Components  ──uses──▶  Hooks            (viewport, filters, caching, compatibility)
           │                    │
           ▼                    ▼
      Contexts (Auth, MobileTools, Compatibility)
           │
           ▼
      Services  (warehouseService, microMarketService, verifiedNumberService, pptService)
           │
           ▼
      apiClient  ──▶ axios instance + interceptors (JWT injection, 401 refresh queue)
           │
           ▼
      Backend /api
```

| Layer | Owns |
|---|---|
| `src/services/` | Every network call. One module per backend resource; all go through `apiClient` (except `pptService`, see below) |
| `src/contexts/` | Cross-cutting app state — auth session, mobile tool modals, browser/device capabilities |
| `src/hooks/` | Reusable behaviour: viewport, view preference, filters, caching, lazy loading, perf monitoring, token expiry |
| `src/components/` | Presentation + local state only |
| `src/utils/` | Pure helpers — JWT decode, token storage, error parsing, media normalization, zone derivation |
| `src/config/` | Env-derived config + a `validateAuthConfig()` startup check |

---

## Key design decisions

### 1. Server-side pagination, with the map fed separately
The list view requests one page at a time (`GET /api/warehouses?page=&limit=`) and gets back
`{ data, pagination }`. But a paginated list would give the map only 20 pins, so the map
calls a **second, dedicated endpoint** — `GET /api/warehouses/coordinates` — which returns
`{ id, lat, lng, availability }` for *every* row matching the current filters, unpaginated.

Two requests, one filter set. The backend shares its `resolveWhere()` between both
endpoints, so the map and the list can never disagree about what's being filtered. Pin
popups fetch full warehouse detail lazily on click.

`warehouseService` exposes three read shapes on purpose:

| Method | Shape | Used by |
|---|---|---|
| `list(params)` | one page + pagination envelope | dashboard table/cards |
| `getCoordinates(params)` | lightweight pins, all matches | map view |
| `getAll()` / `getByIds(ids)` | full objects, `?all=true` | PPT builder, itinerary, micro-market mapping |

### 2. Aggressive code-splitting, enforced by a barrel discipline
The sign-in screen is the first thing most sessions render, so it must not drag in the
whole app. Three deliberate mechanisms:

- **Route-level `lazy()`** for `Dashboard`, `ReviewQueue`, `MicroMarkets`.
- **`components/index.js` deliberately does NOT re-export** `Dashboard`, `ReviewQueue`,
  `WarehouseForm`, or `MapView`. Re-exporting them from the barrel would make them
  statically reachable from *any* barrel import and pull them into the initial bundle. This
  is documented at the top of the file — please keep it that way.
- **`manualChunks`** splits `mapbox-gl` (~1 MB, only reached via dynamic import) and the
  React vendor trio into their own cacheable chunks. **antd is intentionally not forced into
  a single chunk** — doing so pulls every antd component used anywhere (including
  `DatePicker`/`Table`, used only by the lazy routes) into one eager chunk. Letting Rollup
  split antd by static-vs-dynamic reachability keeps lazy-only antd out of the initial load.

`WarehouseForm` (~1.4k lines) and `MapView` are also lazily imported inside `Dashboard`.

### 3. Contact numbers are revealed with a reason, not just hidden
The API redacts `contactNumber` from every list and detail response. `RedactedPhone`
renders a locked chip; revealing prompts (`RevealReasonModal`) for which deal the number is
needed for, and that reason is sent to `GET /warehouses/:id/contact-number` where it's
**validated server-side** and written to the audit log. The client-side bounds in
`utils/revealReason.js` mirror the backend's — the UI is a convenience, not the gate.

Two deliberate exceptions:
- **Staged review rows are not redacted**, so `RedactedPhone` accepts an inline
  `contactNumber` and reveals it without an API call. Without this it would call the master
  endpoint with a staged UUID and silently fail.
- **Opening a record for editing** prefills the real number (otherwise saving would wipe
  it). There's no human to prompt, so it logs a fixed `EDIT_PREFILL_REASON` that says
  exactly that, rather than implying a deal.

### 4. Client-side gating is UX, not security
`ProtectedRoute` guards routes, and `ReviewQueue`/`MicroMarkets` render a 403 `Result` for
users without the capability. This exists so people don't stare at empty screens — the real
enforcement is `requireAccess(CAPS.*)` on the backend, and every gated route returns 403
regardless of what the UI renders.

### 5. Proactive session expiry
Rather than letting a user discover a dead session when a save fails, `useTokenExpiryWatcher`
polls the decoded JWT every 30s, warns at 5 minutes remaining, and on expiry logs out and
redirects to `/session-expired`. It uses `window.location` deliberately, so it works outside
Router context and gives a clean slate.

Separately, `apiClient`'s response interceptor catches 401s, attempts a single refresh, and
**queues** concurrent failed requests behind that one refresh (`isRefreshing` + `failedQueue`)
so a page firing five requests doesn't trigger five refreshes.

### 6. Filter logic lives in a hook, shared by two screens
`useWarehouseFilters` owns every filter field and derives the filtered list with `useMemo`.
The dashboard and the review queue both consume it, so filter semantics can't drift between
the live list and the review panel. The review queue additionally uses its date-range
filters (`submittedAt` / `reviewedAt`), which the dashboard ignores.

### 7. Review queue mirrors the dashboard on purpose
`ReviewQueue` reuses the same `Card` container, `CardView` grid, `WarehouseFilterBar`, and
`WarehouseForm` as the dashboard. A reviewer edits a staged submission in the exact form
they'd use to edit a live warehouse, with Accept/Reject in the sticky footer. Staged rows
arrive flat, so `toFormInitialData` re-nests the `WarehouseData` fields the form expects.

### 8. Mobile is a first-class target, not a media query
Field users open this on phones. `useViewport` drives layout decisions in JS, not just CSS,
and there's a dedicated mobile surface: `MobileHeader`, `MobileNavigation`,
`MobileFilterAccordion`, `ResponsiveModal`, `ResponsiveTable`.

The table view is **desktop-only** — its horizontal-scroll layout is unusable on a phone —
so `Dashboard` computes `effectiveView = isMobile ? 'cards' : currentView`, overriding a
stored `'table'` preference from a desktop session and hiding the switcher.

### 9. Browser/device compatibility layer
`CompatibilityProvider` detects browser, version, and device features on mount, stamps
classes onto `document`, and applies polyfills. `FeatureGate` / `BrowserGate` / `DeviceGate`
render conditionally on that. There's a static `public/browser-update.html` for browsers
below the floor. This exists because the user base includes older Android field devices.

### 10. Media has two representations
Warehouses may carry either the new `media` JSONB (`{ images, videos, docs }`) or the legacy
comma-separated `photos` string. `utils/mediaUtils.getMediaFromWarehouse()` normalizes both,
and every consumer goes through it. Writes double-write both columns.

### 11. `pptService` bypasses `apiClient` deliberately
PPT generation returns a binary blob and can take minutes. It uses raw `fetch` with a
10-minute timeout and its own `Authorization` header, and can point at a different origin
via `VITE_PPT_API_BASE_URL` (falling back to `VITE_API_BASE_URL`) since the generator may be
deployed separately.

---

## Authentication

The **backend is the OAuth client**, not this app. This app only ever holds a JWT.

```
SignInScreen
   └─▶ redirect to Google (client id + backend redirect URI)
          └─▶ Google → BACKEND /auth/google/callback
                 └─▶ backend validates the wareongo.com domain, mints a JWT,
                     redirects back here to /auth/callback?token=…&user=…
                        └─▶ AuthCallback calls setAuthenticated(user, token) → /dashboard
```

On restore, `AuthContext` re-hydrates from storage and best-effort refreshes the profile
from `/auth/me`, so fields added server-side after login (e.g. `isAdmin`) appear without
forcing a re-login.

- **Storage:** `localStorage`, keys `warehouse_auth_token` / `warehouse_user_data`, behind
  `utils/tokenStorage.js` which degrades gracefully when `localStorage` is unavailable
  (private mode, locked-down devices).
- **State:** `AuthContext` — a `useReducer` store exposing
  `{ isAuthenticated, isLoading, user, token, error }` plus
  `setAuthenticated`, `logout`, `refreshToken`, `updateUser`, `retryAuth`, `clearError`,
  `getToken`.
- **Injection:** `apiClient`'s request interceptor attaches `Bearer <token>` only when the
  token decodes and isn't expired.
- **Error surface:** `AuthErrorBoundary` wraps the auth tree so an auth crash shows a
  recoverable screen instead of a white page.

Adding a new frontend needs no Google Console change — the backend owns the only registered
redirect URI. See the backend's `docs/FRONTEND_INTEGRATION_GUIDE.md`.

---

## Data flow

```
User action
   └─▶ Component
         └─▶ Service method (warehouseService.list, .getCoordinates, …)
               └─▶ apiClient  ──▶  [request interceptor: attach JWT]
                                        └─▶ Backend
                                   [response interceptor: unwrap, 401 → refresh + replay]
               ◀── data
         ◀── setState
   ◀── render
                    errors ──▶ utils/errorHandler.parseError() ──▶ antd message/notification
```

File uploads skip the backend entirely for the payload: request a presigned URL, then `PUT`
the file straight to Cloudflare R2.

---

## Project layout

```
src/
├── App.jsx                     # routes, antd dark theme, provider stack
├── main.jsx                    # root render
├── components/
│   ├── Dashboard.jsx           # main screen — list/card/map, filters, CRUD (lazy route)
│   ├── ReviewQueue.jsx         # staged-submission review panel (lazy route)
│   ├── MicroMarkets.jsx        # polygon drawing (lazy route)
│   ├── WarehouseForm.jsx       # the big create/edit form, shared with the review queue
│   ├── MapView.jsx             # Mapbox list-view map (lazy — pulls mapbox-gl)
│   ├── MicroMarketMap.jsx      # Mapbox + mapbox-gl-draw polygon editor
│   ├── RedactedPhone.jsx       # reveal-with-reason chip
│   ├── RevealReasonModal.jsx   # the reason prompt
│   ├── VisitNotes.jsx          # per-warehouse site-visit log
│   ├── PptConfigModal.jsx      # deck generation options
│   ├── PocSelect.jsx           # presentational POC picker; PptConfigModal feeds it
│   │                           #   from verifiedNumberService (session-cached)
│   ├── Mobile*/Responsive*     # mobile surface
│   ├── *Gate / CompatibilityProvider  # browser/device capability gating
│   └── index.js                # barrel — heavy components deliberately excluded
├── contexts/                   # AuthContext, MobileToolsContext, CompatibilityContext
├── hooks/                      # viewport, view preference, filters, caching, perf, token expiry
├── services/                   # warehouse, microMarket, verifiedNumber, auth, ppt, apiClient
├── utils/                      # jwt, tokenStorage, errorHandler, mediaUtils, revealReason, deriveZone
├── config/                     # auth config + env validation
├── styles/                     # responsive.css, compatibility.css
└── test/                       # setup, MSW server + handlers, mock data, test utils
```

---

## Features

| Feature | Entry point | Access |
|---|---|---|
| Warehouse list (table / cards / map / split) | `/`, `/dashboard` | Any authenticated user |
| Create & edit warehouses | `WarehouseForm` | Any authenticated user (creates go to staging) |
| Delete warehouses | context menu | Admin |
| Contact reveal with audited reason | `RedactedPhone` | Any authenticated user |
| Review queue (approve / reject / reopen / autopilot) | `/review` | Reviewer · autopilot toggle is admin |
| Micro-market polygons | `/micro-markets` | Reviewer |
| Site-visit notes | warehouse detail modal | Any user · delete is admin |
| PPT generation | `PptConfigModal` | Any authenticated user |
| Visit itinerary | navbar → Itinerary | Any authenticated user — see [`ITINERARY_FEATURE.md`](ITINERARY_FEATURE.md) |

---

## Getting started

Requires **Node ≥ 22.21.1** (see `.nvmrc` / `engines`; CI builds on 22.21.1).

```bash
git clone https://github.com/WareOnGo/WAG_Dashboard.git
cd WAG_Dashboard
nvm use
npm install
cp .env.example .env     # then fill it in
npm run dev              # Vite dev server on :5173
```

The backend must be running (default `http://localhost:3001`) and must list your dev origin
in its CORS allow-list — `localhost:5173` and `:5174` are already allowed.

```bash
npm run build      # production build → dist/
npm run preview    # serve the build locally
npm run lint       # ESLint
npm test           # Vitest (see Testing)
```

---

## Environment variables

All are baked in at **build time** — changing one requires a rebuild, not a restart.

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend API root, including `/api` |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client id (shared with the backend) |
| `VITE_OAUTH_REDIRECT_URI` | The **backend's** callback URL |
| `VITE_MAPBOX_TOKEN` | Mapbox GL access token — map views degrade to a notice without it |
| `VITE_PPT_API_BASE_URL` | Optional; PPT generator origin, falls back to `VITE_API_BASE_URL` |

`config/validateAuthConfig()` logs which of the required three are missing rather than
failing silently.

---

## Testing

Vitest + Testing Library + jsdom, with **MSW** intercepting network calls
(`src/test/mswHandlers.js`). `vitest.config.js` sets 70% coverage thresholds.

```bash
npm test              # single run
npm run test:watch
npm run test:coverage
```

> **Current status:** parts of the suite have drifted behind the app and do not all pass.
> Don't treat `npm test` as the gate for a change here — **`npm run lint` and
> `npm run build` are the reliable checks**, and they're what the deploy workflow enforces.
> The test workflow (`ci.yml`) still runs on PRs; the deploy workflow
> (`ci-deployment.yml`) has its test step commented out for exactly this reason.
> `src/components/__tests__/` also contains a number of `.md` files that are historical
> implementation notes, not tests.

---

## Deployment

`.github/workflows/ci-deployment.yml`, on push to `main`:

```
npm ci ──▶ lint ──▶ vite build (secrets injected) ──▶ aws s3 sync ──▶ CloudFront invalidation
```

Cache strategy: hashed assets get `max-age=31536000, immutable`; `*.html` gets
`max-age=0, must-revalidate`, so a deploy is picked up immediately without breaking
long-lived asset caching. The bucket is cleared before each sync so removed files don't
linger.

Required repo secrets: `VITE_API_BASE_URL`, `VITE_GOOGLE_CLIENT_ID`,
`VITE_OAUTH_REDIRECT_URI`, `VITE_MAPBOX_TOKEN`, `VITE_PPT_API_BASE_URL`,
`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET`,
`CLOUDFRONT_DIST_ID`.

`.github/workflows/ci.yml` runs lint + coverage on Node 18.x/20.x for PRs to `main`/`develop`.

---

## Gotchas

- **Don't add heavy components to `components/index.js`.** It silently undoes the code
  splitting. The rule and its reasoning are written at the top of that file.
- **Don't force antd into a `manualChunks` entry.** It looks like an optimization and makes
  the initial bundle bigger. See the comment in `vite.config.js`.
- **`utils/constants.js` has a hard-coded App Runner API URL** as its fallback when
  `VITE_API_BASE_URL` is unset. A misconfigured build won't fail loudly — it'll quietly talk
  to production.
- **Env vars are build-time.** A wrong secret in GitHub means a wrong URL compiled into the
  bundle; the deploy workflow greps `dist/` to sanity-check this.
- **Creating a warehouse from the dashboard goes to staging**, not straight to the live
  list. It won't appear in the dashboard until it's approved in `/review`.
- **Zone is derived server-side** from the state. `utils/deriveZone.js` mirrors the backend's
  mapping for display; if you change one, change both.
- **Server-side pagination changed the data contract.** `list()` returns
  `{ data, pagination }`; only `getAll()`/`getByIds()` return flat arrays. Background and
  the original plan are in the untracked `PAGINATION_PLAN.md` one directory up.

---

## Related docs

- [`ITINERARY_FEATURE.md`](ITINERARY_FEATURE.md) — visit itinerary generator
- Backend `README.md` + `docs/STAGING_VALIDATION_LAYER.md` — the review pipeline this UI drives
- Backend `docs/FRONTEND_INTEGRATION_GUIDE.md` — wiring a new frontend to the auth flow

## License

See [LICENSE](LICENSE).
