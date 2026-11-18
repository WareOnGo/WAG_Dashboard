# Warehouse form update

Scout and dashboard forms capture magnitudes separately from units, then save the existing string fields, e.g. `50 feet`. No database migration or numeric conversion is needed. Setback remains unchanged.

- Lengths use feet/metres; highway distance uses metres/km. Land parcels support acres/hectares/sq ft; built-up and carpet areas use sq ft. Square metres are deferred. Existing square-metre records and saved drafts retain their values until explicitly replaced, with no conversion or relabelling.
- Dimensions use three values and one unit; dock dimensions use two. Floor strength uses tonnes/sq m, lighting uses lux and power supports kVA/HP.
- Power also offers “As per requirement”. Checking it disables the number/unit controls and saves that text in `powerKva`; unticking restores the current entry. The option survives Scout drafts and reopens checked on saved records. No schema change is required.
- Only these measurement inputs warn about invalid characters while typing or pasting. Warnings preserve the input and clear as soon as it is corrected.
- Land Type, Canopy, Dock Platform and Flooring use the agreed dropdown options. Ventilation is a collapsed multi-select dropdown; None and Not Known are exclusive.
- International primary/alternate phones use country selectors. Male/female washroom counts serialize into the existing string field.
- Scout retains Employee ID. Dashboard creation uses the signed-in uploader; edits preserve attribution. Nearest-bus input is removed, with historical text retained. Paved-road wording replaces CC Roads.
- Unchanged legacy strings, ranges, totals and missing fields remain saveable. Scout restores existing drafts and uploaded media. Cards, details and PPTs respect explicitly stored units.
- Controls match the existing layout, with joined number/unit inputs and dimensions arranged for mobile. Browser checks cover 320px, 390px and 1280px.

## Required answers

The UI and API always require the PPT v3 answers on new dashboard and Scout submissions, including Land Type and Google Location. Existing blank fields may stay blank; saved answers cannot be cleared. Google pin verification and submission-time geocoding are deferred, so saving does not depend on Google availability.

Release the backend with both frontends; there is no environment switch to enable. Older clients cannot create incomplete records and must reload to supply the original-answer snapshot on edits. Let users finish or copy unfinished entries before refreshing: dashboard edits are not persisted across reloads. See the backend's `docs/form-rollout.md` for the complete required-field and conflict-handling contract.

## Validation

Release checks cover create → staging → review → approval → reopen, subsequent edits, old clients, legacy records, invalid inputs, draft recovery, international numbers and failed Maps requests. All database tests use guarded disposable local PostgreSQL schemas; production data is not used. Google OAuth and external storage are outside these browser tests.

Run `npm test`, `npm run lint` and `npm run build` in both frontend repositories. Dashboard CI also runs `npm run test:coverage`. Browser suites use `npm run test:e2e`, with `TEST_DATABASE_URL` pointing to the guarded local test database, an installed Chrome/Chromium browser, and the backend checkout available as sibling `Backend_Repository` (or via `E2E_BACKEND_ROOT`).
