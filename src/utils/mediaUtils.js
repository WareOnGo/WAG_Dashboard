/**
 * Parse media from the new JSONB column, falling back to parsing legacy photos CSV.
 * @param {{ media?: { images?: string[], videos?: string[], docs?: string[] } | null, photos?: string | null }} warehouse
 * @returns {{ images: string[], videos: string[], docs: string[] }}
 */
const decodeJson = raw => {
  for (let i = 0; i < 2 && typeof raw === 'string'; i++) {
    try { raw = JSON.parse(raw); } catch { break; }
  }
  return raw;
};
const urls = raw => {
  const value = decodeJson(raw);
  return (Array.isArray(value) ? value : [value]).flatMap(entry => typeof entry === 'string'
    ? entry.split(/,\s*(?=https?:\/\/)|,\s+(?![^,]*\/)/i).map(url => url.trim()).filter(Boolean) : []);
};
export const getMediaFromWarehouse = warehouse => {
  const media = decodeJson(warehouse?.media);
  const legacy = { images: [], videos: [], docs: [] };
  for (const url of urls(warehouse?.photos)) {
    const path = url.split(/[?#]/)[0];
    const kind = /\.(mp4|mov|avi|mkv|webm)$/i.test(path) ? 'videos'
      : /\.(pdf|docx?|xlsx?)$/i.test(path) ? 'docs' : 'images';
    legacy[kind].push(url);
  }
  return {
    images: Array.isArray(warehouse?.images)
      ? warehouse.images.map(image => image?.originalUrl).filter(url => typeof url === 'string')
      : Array.isArray(media?.images) ? media.images : legacy.images,
    videos: Array.isArray(media?.videos) ? media.videos : legacy.videos,
    docs: Array.isArray(media?.docs) ? media.docs : legacy.docs,
  };
};

export const imageVariant = (images, originalUrl) =>
  Array.isArray(images) ? images.find(image => image.originalUrl === originalUrl)?.webpUrl : null;

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
