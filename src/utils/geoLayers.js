/**
 * Shared map constants that are not icon-related.
 *
 * Colours and glyphs live in geoIcons.js, next to the code that draws them —
 * keeping a colour in one file and the badge it tints in another is how the two
 * drift apart.
 */

/** Empty FeatureCollection — a module constant so it is referentially stable. */
export const EMPTY_FC = { type: 'FeatureCollection', features: [] };
