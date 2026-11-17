# Field review frontend

The `/field-reviews` route is available in desktop and mobile navigation. Employees see dashboard-style cards with Currently flagged / Previously flagged segments. Admins see To verify / Awaiting employee / Previously flagged / All, using the existing card and queue patterns.

`WarehouseDetailsModal` keeps its normal layout. Its fields now have explicit stable `fieldKey` attributes used only while admin flag selection is active. System metadata and media do not receive a checkbox. The confirmation summary defaults assignment to the eligible uploader returned by the server. Options require Edit permission for this warehouse; if an existing assignee loses access, the summary links to reassignment and disables adding flags. Creation setup/summary resets when the admin identity or role changes, and late requests from the previous session cannot restore it.

`FieldReviewDialog` owns response drafts and each tab's scroll. Flagged fields contains the response controls. All details renders the existing `WarehouseDetailsModal` with flag creation disabled. Employee proposals never replace live values shown in that view.

The queue URL is the source of truth for the open review. Identity/role changes reset queue state and cancel old requests. A late refresh cannot replace a newer successful mutation on screen. Admin replacement prompts use the server's semantic comparison, so formatting-only differences do not ask for an overwrite reason.

`ReviewField` handles direct correction/no-change responses, ordinary admin verification, returns, the three conflict choices, protected values, edit history and reopening. Submitted responses stay read-only until returned by an admin. A stale employee draft preserves its input and requires explicitly checking the refreshed baseline. A stale admin comparison clears the choice, reason and confirmation on refresh or reopening, even if only the live value's revision changed.

Review correction inputs and `WarehouseForm` share `WarehouseFormControls`, form options and control styles. This includes searchable State/City choices, dropdowns that preserve legacy values, calendars with DD/MM/YYYY entry, Yes/No switches, ordered **Add Space Value** inputs and Handover. Measurements, phone numbers, ventilation and washrooms continue to use `StructuredFields`. Labels follow the current edit form, including Compound Gate Width, Security Features, Floor Strength, Lighting and Parking Space Availability.

City options follow the employee's proposed State where present; State and Zone remain separate review items. This does not change the live warehouse or apply unflagged fields. Handover preserves optional/unconfirmed timing; it never supplies an unchosen lead-time unit. Admin choices apply the selected timing type and keep the latest saved values for the other type unchanged. Clearing a date remains a proposed correction until admin verification. String-backed Yes/No switches keep their stored string type.

Availability and Last reviewed form one `availabilityReview` item. The existing View retains its two normal fields, with one checkbox and a note explaining that they are reviewed together. The employee edits both in one card; changing Availability clears the previous review date and asks for the date this answer was checked. Baseline, Proposed, Current, confirmation and history show both values. Each admin choice applies the pair together, and a newer edit to either clears an outdated admin choice/confirmation. No change needed retains its required explanation. All details continues to show live values while the proposed pair is pending.

`CardView` batches marker lookups for the visible dashboard cards. Active markers include Awaiting admin. Successful review writes refresh local queues/markers. A failed marker refresh preserves known flags and offers Retry. Employees who are not assigned see the marker without a link to protected review details.

The production backend migration is required before this UI is enabled. Deployment instructions, API contracts, security rules and V1 limits are in `Backend_Repository/docs/field-review.md`. The resolved Availability/review-date defect and its regression coverage are documented in [the adversarial review](../../Backend_Repository/docs/field-review-adversarial-review.md).

## Tests

```sh
npm test -- src/components/fieldReview/__tests__
npm run build
```

The component suite covers uploader selection and Back navigation, direct employee responses, required no-change explanation, draft/scroll preservation using the real All details component, stale-draft recovery, late refreshes, identity changes, unconfirmed handover timing, semantic value comparisons, three-value admin confirmation and marker refresh failures. Input tests cover shared options, legacy values, ordered areas, measurement validation and stored boolean/string types. Normal form tests check that sharing the controls preserves existing create/edit payloads.

The browser suite uses real production components, API client, JWT middleware, review routes/service and isolated PostgreSQL. Only sign-in and the surrounding dashboard list-loading shell are fixtures. The employee test account has explicit View own/Edit own permissions and is the warehouse's uploader. No review API responses are mocked.

Start a disposable PostgreSQL instance on localhost with the test URL below, then:

```sh
TEST_DATABASE_URL=postgresql://warehouse_test:warehouse_test@127.0.0.1:55445/warehouse_qa E2E_BROWSER_PATH=/usr/bin/google-chrome npm run test:e2e -- e2e/field-review.e2e.mjs --output=/tmp/field-review-browser-artifacts --reporter=list
```

`E2E_BROWSER_PATH` is optional when Playwright Chromium is installed. Each run creates and drops a random schema. The database URL guard refuses non-test databases. The test checks the full create/respond/conflict/no-change/history/reopen flow at 1280px and 390px, verifies live values in the database, asserts no horizontal overflow and saves screenshots for review. A second flow exercises the shared State/City, Handover, area and measurement inputs, preserves drafts across All details, and checks that submissions remain staged. A third flags the availability pair, submits a date correction, detects an intervening Availability edit and rejects a second edit made while the admin's confirmation is open. Run `e2e/form.e2e.mjs` alongside this suite when changing shared controls to verify normal creation, staged review and editing at 320px, 390px and 1280px. Test entry points under `e2e/` are not included in the production build.
