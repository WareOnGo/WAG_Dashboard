# GIS map controls

The GIS route uses the same Map/Satellite selector and current-location action on
mobile and desktop. Satellite uses Mapbox Satellite Streets with the existing
frontend Mapbox token. No backend routes, database fields, or new credentials are
required.

- Switching views preserves the camera, loaded warehouse/POI data, layer
  selections, and any pin being positioned. Each full style load restores the
  custom sources, icons, layers, and the filter hiding a point being moved.
- The location action requests a single browser location fix only after a click.
  During browsing it centers the map and shows a blue location dot. During add
  or move it also updates the draft pin; the existing confirmation/save steps
  still apply. It does not introduce location history or background tracking.
  Once accepted, the camera pans directly to the point at zoom 16 (street level),
  preserving a closer zoom if already selected. It does not zoom out en route.
- Phones/tablets request high accuracy with a 12-second acquisition timeout.
  The browser/OS chooses GPS, Wi-Fi and cellular inputs; high accuracy is a
  request, not a guarantee of GPS availability. Desktop starts with a 6-second
  lookup, allowing a fix cached for up to 30 seconds. Desktop users can request
  a precise attempt explicitly. There are no automatic chained retries.
- If the browser reports uncertainty greater than 1 km, the map and draft stay
  in place. Show area / Use estimate explicitly accepts that broad estimate;
  a desktop user can instead try a precise fix. All displayed positions are
  described as estimates. A provider can still report incorrect coordinates or
  underestimate uncertainty, so users must check the pin before saving.
- Desktop shows a My location label; phones use a crosshair button with an
  accessible name. Controls have at least 44px touch targets and keyboard focus
  indicators. Location feedback replaces the map hint to leave room for the pin
  on small screens. The Map explorer / layer-count overlay is omitted in the
  mobile layout (portrait and landscape); the Layers button still shows the count.
  Mobile location notices use short copy, with broad-estimate choices side by
  side and 44px dismissal/action targets to preserve map space.
- Permission denial, unsupported/insecure browsers, unavailable locations, and
  timeouts have actionable messages. Coarse fixes show their reported accuracy.
  Users can cancel a pending request, and late callbacks
  cannot overwrite a manually repositioned or cancelled draft.
  An app timer bounds unresponsive providers at 7 seconds for a quick request
  and 13 seconds for a precise request, including unanswered permission prompts.
- A failed style switch returns to the previous style. Requests taking over
  15 seconds also attempt recovery. A failure of both styles offers the existing
  page retry action.

The former Place at map center button has been removed.

## Verification

Run focused unit tests in `Frontend_Repository`:

```sh
npm test -- src/components/__tests__/GeoExplorerMap.test.jsx src/components/__tests__/GeoPointEditor.test.jsx src/utils/__tests__/currentLocation.test.js
```

Run production browser checks in `Eval_Harness`:

```sh
HARNESS_MODE=preview npm run eval -- evals/gis-controls.eval.js evals/gis.eval.js --workers=2
```

The checks cover 320px phones, larger phones, landscape, tablet, and desktop;
style restoration and recovery; permission errors; approximate desktop location;
pin confirmation and saving; and existing GIS layer, popup, and editor flows.
The harness uses real React/Mapbox rendering with fixture styles and simulated
browser location. Live satellite imagery, physical-device GPS accuracy, and
native location permission prompts require device checks on the deployed HTTPS
site. Satellite imagery is supplied by Mapbox and is not live camera imagery.

A separate probe of installed Firefox 145 on Linux used a fresh, isolated
profile and a plain local page with real browser geolocation. Both high and
standard accuracy returned POSITION_UNAVAILABLE in that environment. This does
not reproduce the user's existing profile or prove its precise failure cause;
it does confirm that a usable live Firefox location could not be validated here.
