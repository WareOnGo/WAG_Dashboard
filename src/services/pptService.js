import { getStoredToken } from '../utils/tokenStorage.js';
import { isValidToken } from '../utils/jwtUtils.js';

const PPT_API_BASE = import.meta.env.VITE_PPT_API_BASE_URL || import.meta.env.VITE_API_BASE_URL;
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
 * Core PPT download helper — shared by standard and detailed flows.
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
 * Generate and download a Standard PPT.
 */
export async function generateStandardPpt({ ids, selectedImages, includeLocation, customDetails }) {
  const filename = buildFilename(customDetails, ids, false);
  await postPpt('/generate-ppt', { ids, selectedImages, includeLocation, customDetails }, filename);
}

/**
 * Generate and download a Detailed PPT.
 */
export async function generateDetailedPpt({ ids, selectedImages, customDetails }) {
  const filename = buildFilename(customDetails, ids, true);
  await postPpt('/generate-detailed-ppt', { ids, selectedImages, customDetails }, filename);
}
