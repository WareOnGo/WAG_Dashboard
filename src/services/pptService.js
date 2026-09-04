import { getStoredToken } from '../utils/tokenStorage.js';
import { isValidToken } from '../utils/jwtUtils.js';
import { API_BASE_URL } from '../utils/constants.js';

// PPT generation now lives in the dashboard backend (it used to be a separate
// App Runner service). VITE_PPT_API_BASE_URL is kept only as an escape hatch for
// pointing a dev build at a different host; unset, everything goes to the API.
const PPT_API_BASE = import.meta.env.VITE_PPT_API_BASE_URL || API_BASE_URL;

// App Runner terminates any request at ~120s and offers no way to raise it, so a
// longer client timeout only buys a spinner that outlives the dead connection.
// This is set just past the platform's own cut-off so the user gets a real error
// at roughly the moment delivery actually becomes impossible.
const PPT_TIMEOUT_MS = 125_000;

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
 * Core PPT download helper — shared by every PPT flow.
 *
 * Exports are no longer reported from here. Generation moved into the dashboard
 * backend, so it now writes the audit row itself, from what it actually observed
 * rather than from what the browser claimed — including the case this client
 * could never report, where the request is cut off and no code here runs again.
 */
async function postPpt(endpoint, body, fallbackFilename) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PPT_TIMEOUT_MS);

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
  } catch (error) {
    // A timeout aborts the fetch, so surface that rather than a bare "aborted".
    if (controller.signal.aborted) {
      throw new Error(`Timed out after ${PPT_TIMEOUT_MS / 1000}s`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
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
  await postPpt('/generate-detailed-ppt', { ids, selectedImages, customDetails }, filename);
}

/**
 * Generate and download a v2 PPT (sidebar layout, photo grid, fixed cover hero).
 */
export async function generatePptV2({ ids, selectedImages, customDetails }) {
  const filename = buildFilename(customDetails, ids, false);
  await postPpt('/generate-ppt-v2', { ids, selectedImages, customDetails }, filename);
}

/**
 * Generate and download a v3 PPT — v2's branding with the fuller specification
 * table and the photographs on a slide of their own.
 */
export async function generatePptV3({ ids, selectedImages, customDetails }) {
  const filename = buildFilename(customDetails, ids, false);
  await postPpt('/generate-ppt-v3', { ids, selectedImages, customDetails }, filename);
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
  await postPpt('/generate-ppt-godamwale', { ids, selectedImages, customDetails }, filename);
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
  await postPpt('/generate-ppt-tci', { ids, selectedImages, customDetails }, filename);
}

/** Generate and download the Last Mile Excel comparison using the shared export flow. */
export async function generateLastMileExcel({ ids, selectedImages, customDetails }) {
  const requirement = customDetails?.clientRequirement?.trim();
  const filename = requirement
    ? `Last Mile - WH options_${requirement}.xlsx`
    : `Last Mile_Warehouses_${ids.replace(/,\s*/g, '_')}.xlsx`;
  await postPpt('/generate-xlsx-last-mile', { ids, selectedImages, customDetails }, filename);
}
