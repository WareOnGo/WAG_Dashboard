# GIS UX audit — 9 September 2026

The mobile GIS page gave most of its height to a permanently expanded layer list. The map, the selected warehouse card, and the placement controls competed for the remaining space. This change makes exploration the default, puts layers behind an explicit control, and gives point creation a visible two-step workflow.

This is an expert review with browser regression testing, not a study with representative users. The audit covers `/map`, its layer requests, point creation/edit/move/delete, warehouse detail handoff, accessibility affordances, and phone/tablet/desktop layouts. Related dashboard map and navigation flows were also checked for regressions.

## Method and design basis

1. Walk through the main tasks: identify a warehouse, enable nearby reference places, add a point, correct its details/location, and recover from a failed request.
2. Inspect the supplied mobile screenshot and the implementation for visibility, feedback, control, target size, and error recovery. Rank findings by impact on task completion.
3. Apply progressive disclosure and explicit actions, then exercise the complete flow against a mocked API in a real browser.
4. Review screenshots at 320×568, 390×844, 412×915, 844×390, 768×1024, and 1440×900. Check viewport geometry and persistence as well as appearance.
5. Record what is covered by automation and what still needs device and field validation.

The design draws on these sources:

- [NN/g: Bottom Sheets — Definition and UX Guidelines](https://www.nngroup.com/articles/bottom-sheet/). Temporary controls and contextual details suit a dismissible sheet. Applied here as a modal layer chooser and a nonmodal selected-place card; users can keep exploring while reading a place.
- [Material Design: Bottom sheets](https://m1.material.io/components/bottom-sheets.html). Supports contextual place details beside a map and adapting their position for larger displays. Desktop retains a sidebar; phones use bottom panels.
- [NN/g: Maps and Location Finders on Mobile Devices](https://www.nngroup.com/articles/mobile-maps-locations/). Identifies conflicts between page scrolling and map panning, imprecise touch selection, and weak response feedback. This older locator research is useful for those failure modes; its recommendation to favor lists is not applied wholesale to a dedicated GIS workspace.
- [W3C: Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html). Uses a 44 CSS pixel target for enhanced accessibility. GIS buttons and layer rows now use at least 44px targets. This does not establish WCAG conformance for the entire canvas map; dense geographic pins remain a separate limitation.

## Findings and changes

| Priority | Finding and effect | Implemented change | Verification |
| --- | --- | --- | --- |
| P0 | Layer list occupied most of the phone screen and pushed map content out of reach. | Map fills the space below the app header. Layers open in a bounded, scrollable bottom drawer; sections collapse and reference layers are searchable. | Phone viewport geometry, drawer dismissal/focus return, search and toggle requests. |
| P0 | Starting or confirming placement could change screen position. The auth wrapper reserved a full viewport inside a shorter content pane, allowing focus to scroll the map upward. | Correct wrapper height; keep camera and map element position unchanged. Taps and drags move only the draft pin. No automatic panning/zooming during add or reposition. | Unit assertions against camera methods; browser assertion that canvas bounding box is identical before and during placement. |
| P1 | Placement depended on an unexplained map click and a small anchored form. | Step 1: position a visible pin, then Use this location. Step 2: labeled details form, then Save point. Cancel in both steps. Place at map center offers a button alternative after keyboard panning. | Add/cancel/reposition/save flows, submitted coordinates, saved pin rendered at chosen location. |
| P1 | Small forms risked clipped fields, weak labels and keyboard obstruction. | Mobile drawer with scrollable fields, fixed actions, 16px inputs, visual-viewport adjustment, and no automatic input focus. Desktop uses a modal. | Draft retention and form unit tests; simulated viewport checks and a native Android IME test keep Save above the keyboard area. |
| P1 | Selected-place popups had no explicit close control and could be clipped near screen edges. | Dock mobile details above attribution; bound their height and allow scrolling. Visible close button remains reachable. | Selected point and warehouse screenshots; warehouse detail handoff. |
| P1 | Enabling another reference category inside a cached bounding box could show no new points. Slow responses could replace newer selections. | Cache includes selected categories; reject stale request results; apply current visibility when style loading completes. | Category-toggle browser assertions and stale-response unit test. |
| P1 | Failed viewport requests looked like empty data. | Visible loading and failure feedback with Retry; independent layers can still render. | Injected read failure and recovery. |
| P1 | Saving while Our points was hidden made a successful new point invisible. | Automatically enable Our points after creation and report where it was saved. | Create with layer initially disabled, then open the saved pin. |
| P1 | Form errors/repositioning could discard context; deletion immediately wrote after a menu click. | Retain form draft and selected coordinates across reposition; retain values on failed save. Require Confirm delete. | Stateful CRUD browser tests and editor unit tests. |
| P2 | Tiny controls, ambiguous marker colors, and a long reference list raised interaction cost. | 44px controls, larger symbols and expanded touch hit testing, warehouse availability legend, active layer count, clear reference layers, explicit empty states. | Touch flows and viewport checks; screenshot review. |

The user's explicit requirement is preserved: **adding a point must not refocus or recenter the map or shift its screen position.** Reposition also preserves the draft and the viewport. Users remain free to pan and zoom deliberately.

## Evidence

The supplied production screenshot is retained as [mobile-before.png](gis-ux-audit/mobile-before.png). Reviewed after screenshots are stored alongside it. Their basemap is intentionally flat: the harness serves deterministic Mapbox styles and real GeoJSON fixture pins without spending tile quota or contacting production APIs.

The harness previously returned placeholder arrays for GIS endpoints. It now returns the backend's actual GeoJSON/envelope shapes, realistic category metadata, and stateful point CRUD. Browser tests exercise the real React/Mapbox components and network client. Camera behavior, stale requests, form validation, and draft persistence also have focused unit tests.

Validation: **21/21 production browser checks passed**, including 12 GIS checks and 9 related access/navigation/dashboard checks. **37/37 focused unit tests passed**. Changed JavaScript/JSX passes ESLint and the production build succeeds. The build retains its existing large-bundle warning.

The complete regression report is [available in the harness](../../Eval_Harness/artifacts/20260909-005957/report.html). It contains 20 screenshots and records zero blocked requests or unmodeled endpoints. The final warehouse-action follow-up also passed: [focused report](../../Eval_Harness/artifacts/20260909-010244/report.html).

| Reviewed frame | Artifact |
| --- | --- |
| Default mobile map | [mobile-map.png](gis-ux-audit/mobile-map.png) |
| Mobile layers | [mobile-layers.png](gis-ux-audit/mobile-layers.png) |
| Positioning a pin, viewport unchanged | [mobile-position-pin.png](gis-ux-audit/mobile-position-pin.png) |
| Recovering from a failed save | [mobile-save-retry.png](gis-ux-audit/mobile-save-retry.png) |
| Selected place | [mobile-place-details.png](gis-ux-audit/mobile-place-details.png) |
| Warehouse summary | [mobile-warehouse-card.png](gis-ux-audit/mobile-warehouse-card.png) |
| Reduced visual viewport | [mobile-keyboard-viewport.png](gis-ux-audit/mobile-keyboard-viewport.png) |
| Desktop map | [desktop.png](gis-ux-audit/desktop.png) |

## Native Android keyboard validation

The optional Android harness now runs the production frontend inside Android
Chrome with the actual Gboard IME. The final
[native keyboard run](../../Eval_Harness/artifacts/20260909-013947/report.html)
passed its complete add-point flow, with four full-device screenshots, zero
unmodeled endpoints and zero blocked application requests. Android reports its
IME window and input view visible; the test waits for the viewport and drawer
to settle before checking Save. It sends text through Android input commands,
without assigning DOM values or mocking viewport geometry.

Environment: Android 16 / API 36.1 Google Play x86_64 image, emulator 36.4.9,
Chrome 134.0.6998.135, 1080×2400 display at 420 dpi. This installed Chrome version
is the tested configuration; it is not a claim of current-browser coverage.
The headless run used `-gpu swangle` after other renderers failed during setup.

The visible viewport shrank from 810.29 to 449.90 CSS px. Save ended at 438.19 px,
remaining above the keyboard. Hiding and reopening the keyboard retained the
name and chosen point type; tapping Save while it was open submitted the chosen
coordinates. The map's rectangle stayed identical through placement, keyboard
open and save, with page scroll remaining at zero. No further frontend change
was required by this run.

- [Keyboard open](gis-ux-audit/android-keyboard-open.png)
- [Keyboard reopened](gis-ux-audit/android-keyboard-reopened.png)
- [Recorded viewport and map geometry](../../Eval_Harness/artifacts/20260909-013947/android-keyboard-metrics.json)
- [Runner instructions](../../Eval_Harness/README.md#native-android-keyboard)

## Remaining validation and follow-up

- Test physical iOS Safari and Android Chrome/WebView, including current browser versions, vendor keyboards, toolbar changes and safe areas. The Android suite covers native keyboard visibility, viewport resizing, draft retention and saving on an emulator; it does not cover iOS or predictive-text/composition behavior from tapping individual Gboard keys.
- Dense real map areas, live tile loading, weak connectivity and lower-end GPU performance need field checks. Larger symbols and touch hit testing do not resolve coincident points. A future candidate chooser/list would provide both disambiguation and an accessible alternative to canvas-only selection.
- City/address search and an explicit current-location action remain useful follow-ups. They need decisions about search coverage, geocoding services and permission/error behavior; neither is introduced by this patch.
- Run a short moderated session with field users: find a warehouse and nearby fuel, save a site, move it, and recover from offline saving. Record completion without help, accidental moves, time to recover, and whether users can explain where their saved point went. No user-study outcomes are claimed here.
- The optional vision judge was not enabled. Screenshots were inspected manually; this is not an accepted pixel-baseline comparison or a live-backend acceptance test.
