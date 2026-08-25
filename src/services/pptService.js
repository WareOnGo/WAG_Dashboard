import { getStoredToken } from '../utils/tokenStorage.js';
import { isValidToken } from '../utils/jwtUtils.js';
// Exports are audited by the dashboard backend, which is a different origin from
// the PPT engine in production — the engine sits on its own App Runner service.
// Reuses the shared constant so the audit call inherits its production fallback
// rather than posting to "undefined/..." when the env var is missing.
import { API_BASE_URL } from '../utils/constants.js';

const PPT_API_BASE = import.meta.env.VITE_PPT_API_BASE_URL || API_BASE_URL;
const PPT_TIMEOUT_MS = 600_000; // 10 minutes

/**
 * Extract filename from Content-Disposition header (if ever set by backend).
 */
function extractFilename(contentDisposition, fallback) {
  if (!contentDisposition) return fallback;
  const utf8 = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8?.[1]) return decodeURIComponent(utf8[1]);
  const basic = contentDisposition.match(/filename="?([^";]+)"?/i);
  if (basic?.[1]) return basic[1];
  return fallback;
}

/**
 * Build an Authorization header if the user has a valid JWT.
 */
function authHeaders() {
  const token = getStoredToken();
  if (token && isValidToken(token)) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Trigger a browser download from an in-memory Blob.
 */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Fetch warehouses by comma-separated IDs (for preview before generation).
 */
export async function fetchWarehousesByIds(idsCsv) {
  const res = await fetch(`${PPT_API_BASE}/warehouses?ids=${encodeURIComponent(idsCsv)}`, {
    headers: { ...authHeaders() },
  });

  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {
      const t = await res.text();
      if (t) msg = t.slice(0, 240);
    }
    throw new Error(msg);
  }

  return res.json();
}

/**
 * Parse the warehouse-id CSV the PPT endpoints take into ints.
 * Tolerates blanks and stray whitespace; TCI allows an empty list.
 */
function parseWarehouseIds(idsCsv) {
  return String(idsCsv || '')
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, 200); // matches the backend's cap, so a paste-gone-wrong still logs
}

/** How many images the user hand-picked, across all warehouses. Counts only. */
function countSelectedImages(selectedImages) {
  if (!selectedImages || typeof selectedImages !== 'object') return 0;
  return Object.values(selectedImages)
    .reduce((total, urls) => total + (Array.isArray(urls) ? urls.length : 0), 0);
}

/**
 * Report a finished export to the dashboard backend's audit log.
 *
 * The browser posts PPTs straight to the proposal engine, so the backend never
 * sees the request and cannot log it — the client reports its own instead.
 *
 * Deliberately best-effort: this must never affect the download. It is called
 * after the outcome is known (so a row means a real attempt, not an intent),
 * never awaited by the caller, swallows every error, and is skipped entirely
 * when there is no valid token, since it would only 401.
 *
 * Sends counts and identifiers, never warehouse data or the selected image URLs.
 */
function reportExport(payload) {
  const headers = authHeaders();
  if (!headers.Authorization) return;

  try {
    fetch(`${API_BASE_URL}/audit/ppt-export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(payload),
      // The download often starts a tab-closing navigation right after; keepalive
      // lets the report survive it.
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Never let audit reporting surface to the user.
  }
}

/**
 * Core PPT download helper — shared by every PPT flow.
 *
 * `variant` is the audit label for which PPT was built; it is reported, not sent
 * to the engine. Instrumented here rather than in the four variant wrappers, so
 * a variant added later cannot silently skip the audit log.
 */
async function postPpt(endpoint, body, fallbackFilename, variant) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PPT_TIMEOUT_MS);
  const startedAt = Date.now();

  // Details for the audit row, filled in as the outcome becomes known.
  const report = {
    variant,
    warehouseIds: parseWarehouseIds(body?.ids),
    outcome: 'failed',
    selectedImageCount: countSelectedImages(body?.selectedImages),
  };
  const client = body?.customDetails?.clientName?.trim();
  const company = body?.customDetails?.companyName?.trim();
  const requirement = body?.customDetails?.clientRequirement?.trim();
  if (client) report.clientName = client;
  if (company) report.companyName = company;
  if (requirement) report.clientRequirement = requirement;

  try {
    const res = await fetch(`${PPT_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders(),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    report.httpStatus = res.status;

    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      try {
        const j = await res.json();
        if (j?.error) msg = j.error;
      } catch {
        const t = await res.text();
        if (t) msg = t.slice(0, 240);
      }
      throw new Error(msg);
    }

    const blob = await res.blob();
    const filename = extractFilename(
      res.headers.get('Content-Disposition'),
      fallbackFilename,
    );
    downloadBlob(blob, filename);

    report.outcome = 'success';
    report.bytes = blob.size;
  } catch (error) {
    // A timeout aborts the fetch, so record that rather than a bare "aborted".
    report.errorMessage = (controller.signal.aborted
      ? `Timed out after ${PPT_TIMEOUT_MS / 1000}s`
      : error?.message || 'Unknown error').slice(0, 500);
    throw error;
  } finally {
    clearTimeout(timer);
    report.durationMs = Date.now() - startedAt;
    // Failures are logged too — an attempted export is worth recording.
    reportExport(report);
  }
}

/**
 * Build a download filename from custom details.
 */
function buildFilename(customDetails, idsCsv, isDetailed) {
  const client = customDetails?.clientName?.trim() || customDetails?.companyName?.trim();
  const requirement = customDetails?.clientRequirement?.trim();

  if (client) {
    const reqText = requirement || 'Requirement';
    return `WH options for ${client}_${reqText}.pptx`;
  }
  const prefix = isDetailed ? 'Detailed_Warehouses' : 'Warehouses';
  return `${prefix}_${idsCsv.replace(/,\s*/g, '_')}.pptx`;
}

/**
 * Generate and download a Detailed PPT.
 */
export async function generateDetailedPpt({ ids, selectedImages, customDetails }) {
  const filename = buildFilename(customDetails, ids, true);
  await postPpt('/generate-detailed-ppt', { ids, selectedImages, customDetails }, filename, 'detailed');
}

/**
 * Generate and download a v2 PPT (sidebar layout, photo grid, fixed cover hero).
 */
export async function generatePptV2({ ids, selectedImages, customDetails }) {
  const filename = buildFilename(customDetails, ids, false);
  await postPpt('/generate-ppt-v2', { ids, selectedImages, customDetails }, filename, 'v2');
}

/**
 * Generate and download a Godamwale-branded PPT (external).
 * Photos come exclusively from selectedImages; DB photos are not used.
 */
export async function generateGodamwalePpt({ ids, selectedImages, customDetails }) {
  const client = customDetails?.clientName?.trim() || customDetails?.companyName?.trim();
  const requirement = customDetails?.clientRequirement?.trim();
  const filename = client
    ? `Godamwale - WH options for ${client}_${requirement || 'Requirement'}.pptx`
    : `Godamwale_Warehouses_${ids.replace(/,\s*/g, '_')}.pptx`;
  await postPpt('/generate-ppt-godamwale', { ids, selectedImages, customDetails }, filename, 'godamwale');
}

/**
 * Generate and download a TCI-branded PPT (external).
 * `ids` may be empty — backend falls back to placeholder warehouses.
 */
export async function generateTciPpt({ ids, selectedImages, customDetails }) {
  const client = customDetails?.clientName?.trim() || customDetails?.companyName?.trim();
  const requirement = customDetails?.clientRequirement?.trim();
  const idsForName = (ids || '').trim();
  const filename = client
    ? `TCI - WH options for ${client}_${requirement || 'Requirement'}.pptx`
    : idsForName
      ? `TCI_Warehouses_${idsForName.replace(/,\s*/g, '_')}.pptx`
      : `TCI_Warehouses_Preview.pptx`;
  await postPpt('/generate-ppt-tci', { ids, selectedImages, customDetails }, filename, 'tci');
}
