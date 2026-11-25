// The normal warehouse response supplies photos and surrounding context. Only
// the captured QA fields override it; current values must not rewrite findings.
export function snapshotWarehouse(row, context = {}) {
  const warehouse = {
    ...context,
    id: row.warehouse_id,
    WarehouseData: { ...(context.WarehouseData || context.warehouseData) },
    imageLabels: context.imageLabels || {}
  };
  for (const [key, value] of Object.entries(row.fields)) {
    if (key.startsWith('warehouseData.')) warehouse.WarehouseData[key.slice('warehouseData.'.length)] = value;
    else if (key === 'availabilityReview' || key === 'handover') Object.assign(warehouse, value);
    else warehouse[key] = value;
  }
  return warehouse;
}

export function initialReview(row) {
  return Object.fromEntries(
    row.candidates.map((candidate) => {
      const suggestion =
        candidate.suggested_note ??
        [...new Set(candidate.findings.map((finding) => finding.explanation))].join('\n').slice(0, 500);
      return [
        candidate.field_key,
        {
          selected: candidate.decision !== 'REJECTED',
          note: candidate.decision === 'REJECTED' ? suggestion : candidate.admin_note || suggestion,
          rejectionNote: candidate.decision === 'REJECTED' ? candidate.admin_note : '',
          reason: candidate.decision_reason || '',
          missedRule: candidate.missed_rule_id || ''
        }
      ];
    })
  );
}

export function reviewPayload(row, draft) {
  const machineKeys = new Set(
    row.candidates
      .filter((candidate) => candidate.source === 'MACHINE')
      .map((candidate) => candidate.field_key)
  );
  return {
    machine: [...machineKeys].map((field_key) => ({
      field_key,
      decision: draft[field_key].selected ? 'APPROVED' : 'REJECTED',
      note: (draft[field_key].selected ? draft[field_key].note : draft[field_key].rejectionNote).trim(),
      reason: draft[field_key].selected ? null : draft[field_key].reason
    })),
    human: Object.entries(draft)
      .filter(([key, field]) => field.selected && !machineKeys.has(key))
      .map(([field_key, field]) => ({
        field_key,
        note: field.note.trim(),
        missed_rule_id: field.missedRule || null
      }))
  };
}
