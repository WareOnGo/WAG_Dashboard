import { useEffect, useMemo, useState } from 'react';
import { fieldReviewService } from '../../services/fieldReviewService';
import { embeddedFieldReview, fieldReviewAccessKey } from '../../utils/fieldReviewPermissions';

const emptyFields = new Map();
const summaryFields = summary => {
  const fields = new Map((summary?.activeFieldKeys || []).map(key => [key, null]));
  for (const field of summary?.activeFields || []) fields.set(field.fieldKey, field.comment);
  return fields;
};

export default function useFieldReviewHighlights({ warehouse, warehouseId, visible, user }) {
  const accessKey = fieldReviewAccessKey(user);
  const embedded = embeddedFieldReview(warehouse, accessKey);
  const source = useMemo(() => ({ warehouseId, accessKey, embedded }), [warehouseId, accessKey, embedded]);
  const scope = useMemo(() => ({ source, visible }), [source, visible]);
  const initialFields = useMemo(() => summaryFields(embedded), [embedded]);
  const enabled = visible && Number.isInteger(warehouseId) && warehouseId > 0;
  const [result, setResult] = useState(null);
  const [request, setRequest] = useState(null);
  // A refresh supersedes its bundled snapshot even after closing/reopening.
  // Unbundled callers still get a new lookup on every opening. Identity, role,
  // warehouse and replacement-bundle changes each create a different source.
  const current = result?.scope === scope || (embedded !== undefined && result?.source === source) ? result : null;
  const refreshRequest = request?.source === source ? request : null;
  const requestKey = refreshRequest || scope;
  const needsFetch = enabled && (embedded === undefined || (!!refreshRequest && current?.requestKey !== requestKey));

  useEffect(() => {
    if (!needsFetch) return;
    const controller = new AbortController();
    fieldReviewService.summaries([warehouseId], controller.signal).then(rows => {
      if (controller.signal.aborted) return;
      const summary = rows.find(row => row.warehouseId === warehouseId);
      setResult({ source, scope, requestKey, fields: summaryFields(summary), error: false });
    }).catch(error => {
      if (controller.signal.aborted) return;
      setResult(previous => ({
        source,
        scope,
        requestKey,
        fields: [401, 403].includes(error.response?.status) ? emptyFields
          : previous?.source === source ? previous.fields : initialFields,
        error: true,
      }));
    });
    return () => controller.abort();
  }, [needsFetch, warehouseId, source, scope, requestKey, initialFields]);

  useEffect(() => {
    if (!enabled) return;
    const refresh = () => setRequest({ source });
    window.addEventListener('warehouse-field-review-updated', refresh);
    return () => window.removeEventListener('warehouse-field-review-updated', refresh);
  }, [enabled, source]);

  const loading = needsFetch && current?.requestKey !== requestKey;
  return {
    fields: enabled ? current?.fields || initialFields : emptyFields,
    error: enabled && !loading && !!current?.error,
    loading,
    refreshing: loading && (!!current || embedded !== undefined),
    refresh: () => setRequest({ source }),
  };
}
