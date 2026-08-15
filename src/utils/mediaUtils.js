/**
 * Parse media from the new JSONB column, falling back to parsing legacy photos CSV.
 * @param {{ media?: { images?: string[], videos?: string[], docs?: string[] } | null, photos?: string | null }} warehouse
 * @returns {{ images: string[], videos: string[], docs: string[] }}
 */
export const getMediaFromWarehouse = (warehouse) => {
  if (warehouse.media) return warehouse.media;

  // Fallback: parse legacy photos CSV into media shape
  if (warehouse.photos && typeof warehouse.photos === 'string') {
    const urls = warehouse.photos.split(',').map(u => u.trim()).filter(Boolean);
    return { images: urls, videos: [], docs: [] };
  }

  return { images: [], videos: [], docs: [] };
};

/**
 * Display order and copy for image classifications. UNKNOWN is folded into
 * "Other" alongside unlabelled images — the distinction between "the model
 * couldn't tell" and "not labelled yet" matters to us, not to someone browsing
 * a listing.
 */
export const IMAGE_SECTIONS = [
  { key: 'INDOOR', title: 'Indoor' },
  { key: 'OUTDOOR', title: 'Outdoor' },
  { key: 'DOCUMENT', title: 'Documents' },
  { key: 'OTHER', title: 'Other' },
];

/**
 * Split image URLs into classified sections, preserving media order within each.
 *
 * Returns null ONLY when there is no label data to segment by — no images, or
 * no labels at all. That null is the fallback signal: labels are additive, and
 * their absence must never hide an image.
 *
 * A single section is still returned and still rendered. Plenty of listings are
 * legitimately all-outdoor (a site under construction, say), and suppressing the
 * heading there made the feature look broken rather than tidy — the label is
 * information about the photos, not decoration to hide when it is uniform.
 *
 * Every URL passed in appears in exactly one section, so nothing is ever
 * dropped by a missing or unrecognised label.
 *
 * @param {string[]} imageUrls - URLs in media order
 * @param {Record<string, { classification?: string }>} [labels] - keyed by URL
 * @returns {Array<{ key: string, title: string, urls: string[] }> | null}
 */
export const groupImagesByClassification = (imageUrls, labels) => {
  if (!Array.isArray(imageUrls) || imageUrls.length === 0) return null;
  if (!labels || Object.keys(labels).length === 0) return null;

  const buckets = { INDOOR: [], OUTDOOR: [], DOCUMENT: [], OTHER: [] };
  for (const url of imageUrls) {
    const cls = labels[url]?.classification;
    (buckets[cls] ? buckets[cls] : buckets.OTHER).push(url);
  }

  const sections = IMAGE_SECTIONS
    .map(({ key, title }) => ({ key, title, urls: buckets[key] }))
    .filter((s) => s.urls.length > 0);

  return sections.length > 0 ? sections : null;
};
