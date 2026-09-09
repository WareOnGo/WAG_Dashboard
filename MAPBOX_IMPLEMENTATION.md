# Maps in the Dashboard

The app has three map surfaces with different data scopes:

| Surface | Open from | Data and purpose |
|---|---|---|
| Dashboard split map | Cards view → map toggle | Coordinates for every warehouse matching the dashboard filters, alongside the current card page |
| GIS / Map explorer | GIS navigation link, `/map` | Warehouses, internal points, and selected reference-place layers in the current map area |
| Micro-market editor | `/micro-markets` | Draw and edit named area polygons with warehouse pins for context |

## Configuration

Add `VITE_MAPBOX_TOKEN` to the frontend `.env` for local development. The deployment
workflow supplies it from the repository secret of the same name. Vite includes the
value at build time, so changes require restarting the dev server or rebuilding the app.

The map components use Mapbox GL JS and include its CSS. Micro-market drawing also uses
`@mapbox/mapbox-gl-draw`. Install the repository dependencies with `npm ci`; these packages
are already declared in `package.json`.

Mapbox styles and tiles load separately from warehouse data. A map needs both a usable
Mapbox token/style and access to the relevant backend endpoints. With no token, the
dashboard map logs a console warning and skips initialization; the GIS map displays a
configuration notice.

## Dashboard split map

On desktop, select **Cards**, then **Show Map**. On mobile, cards are always used and the
map toggle appears as an icon. The map sits beside the cards on desktop and above them
on mobile, where it scrolls with the page.

[`Dashboard.jsx`](src/components/Dashboard.jsx) owns two separate requests:

- `warehouseService.list({ ...filters, page, limit, includeImageLabels: 'true' })` loads
  one server page and its total for the list.
- `warehouseService.getCoordinates(filters)` loads `{ id, lat, lng, availability }`
  for all matching warehouses while the split map is visible.

The coordinate payload is adapted to top-level `latitude` and `longitude` for
[`MapView.jsx`](src/components/MapView.jsx). The component omits records without usable
coordinates. Its pin count can therefore differ from the list's total.

Filter changes share the dashboard's 300 ms debounce. Changing the list page leaves the
coordinate set intact. Successful edits, visibility changes, deletions, and immediately
promoted creates refresh the current list and open map coordinates. Pending submissions
do not enter the live map. Losing dashboard access clears coordinates and invalidates
pending responses.

Pins expose a summary popup with **View** and **Edit** actions. The first popup open
fetches the full warehouse through `getById(id)`; that record is cached for the mounted
map instance. Coordinate refreshes update marker membership and positions, but do not
invalidate this popup-detail cache. Hide and reopen the split map to obtain fresh popup
details after a record changes.

The map resizes with its container and handles window resize/orientation changes. Its
markers, observers, and event listeners are removed when the component unmounts.

## GIS / Map explorer

[`GeoExplorer.jsx`](src/components/GeoExplorer.jsx) provides the layer controls and point
editor around [`GeoExplorerMap.jsx`](src/components/GeoExplorerMap.jsx). Dashboard access
is required. Warehouses and **Our points** start enabled; reference-place categories
start disabled and can be selected or searched in the layer controls.

[`geoService.js`](src/services/geoService.js) supplies the layer catalogue and viewport
requests under `/geo/layers`, `/geo/warehouses`, `/geo/points`, and `/geo/osm-pois`.
The viewport is sent as `west,south,east,north`. Requests cover a padded area, allowing
small pans inside already loaded bounds without another fetch. Reference categories
and returned truncation flags are handled separately from the dashboard's filters and
pagination.

Use **Add a point** to place an internal location. The UI offers edit, move, and delete
actions to the point's author or an admin; the backend enforces mutation permissions.
Warehouse details load on demand and use the shared warehouse details modal. On mobile,
layer controls open in a bottom drawer.

## Micro-market editor

[`MicroMarkets.jsx`](src/components/MicroMarkets.jsx) is available to reviewers and admins.
It loads warehouse context with `warehouseService.getAll()` and persists named polygons
through [`microMarketService.js`](src/services/microMarketService.js).

[`MicroMarketMap.jsx`](src/components/MicroMarketMap.jsx) handles Mapbox Draw events for
polygon creation, geometry changes, and deletion. It draws polygon outlines in a separate
map layer to keep them visible with the current Mapbox GL style. This editor has its own
data lifecycle; it does not use the dashboard's paginated list or split-map refresh state.

See [Dashboard behavior](README.md#dashboard-behavior) for list refresh and access rules.
