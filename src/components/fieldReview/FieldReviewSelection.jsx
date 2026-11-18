import { useContext } from 'react';
import { Checkbox, Input, Tag } from 'antd';
import { FieldReviewSelectionContext } from './SelectionContext';
import { FieldReviewHighlightContext } from './HighlightContext';
export default function FieldReviewSelection({
  label,
  fieldKey
}) {
  const selection = useContext(FieldReviewSelectionContext);
  const highlighted = useContext(FieldReviewHighlightContext);
  if (!selection) return null;
  const field = selection.fields.find(f => f.key === fieldKey);
  if (!field) return null;
  const linked = field.type === 'availabilityReview';
  const selectionLabel = linked ? field.label : label;
  const hint = linked ? <p className="fr-help">Availability and Last reviewed are flagged and verified together.</p> : null;
  const existing = selection.activeFields.find(f => f.key === field.key);
  if (existing) return <>{!highlighted.has(field.key) && <Tag className="fr-field-marker" color="orange">Flagged for review</Tag>}{hint}</>;
  const checked = selection.selected.includes(field.key);
  return <div className="fr-selection">
  <Checkbox aria-label={'Flag ' + selectionLabel} checked={checked} onChange={e => selection.toggle(field.key, e.target.checked)} />
  {hint}
  {checked && <Input.TextArea aria-label={'Review comment for ' + selectionLabel} required maxLength={500} showCount value={selection.comments[field.key] || ''} onChange={e => selection.comment(field.key, e.target.value)} placeholder="What needs checking?" autoSize={{
      minRows: 2,
      maxRows: 4
    }} />}
 </div>;
}
