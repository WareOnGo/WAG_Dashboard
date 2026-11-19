import { formatValue } from './values';
const actions = {
  CREATED: 'Flagged for review',
  SUBMITTED: 'Response submitted',
  VERIFIED: 'Verified and closed',
  CANCELLED: 'Flag cancelled',
  RETURNED: 'Changes requested',
  REOPENED: 'Flag reopened',
  REASSIGNED: 'Assignee changed',
  REVEALED: 'Protected values viewed',
  UPLOAD_PREPARED: 'Media upload prepared'
};
const decisions = {
  CURRENT: 'Kept current',
  PROPOSED: 'Applied proposed',
  BASELINE: 'Restored baseline'
};
const snapshots = [['originalValue', 'Value when flagged'], ['baselineValue', 'Baseline'], ['proposedValue', 'Proposed'], ['currentValue', 'Current at decision'], ['finalValue', 'Verified value']];
export default function ReviewActivity({
  events,
  flags,
  people
}) {
  return events.map(event => {
    const payload = event.payload || {};
    const field = flags.find(flag => flag.id === event.flagId || flag.fieldKey === payload.fieldKey)?.field;
    const fieldLabel = payload.labelSnapshot || field?.label;
    const person = id => people.find(p => p.id === id)?.name || 'Previously assigned employee';
    return <div className="fr-event" key={event.id}>
      <strong>{actions[event.action] || 'Review updated'}{fieldLabel ? ' · ' + fieldLabel : ''}</strong>
      <small>{event.actorName || event.actorEmail} · {new Date(event.createdAt).toLocaleString('en-IN')}</small>
      {payload.explanation && <p>{payload.explanation}</p>}
      {payload.comment && <p>{payload.comment}</p>}
      {payload.reason && <p>Reason: {payload.reason}</p>}
      {event.action === 'CANCELLED' && <p>Warehouse value unchanged.</p>}
      {payload.resolution === 'NO_CHANGE' && <p>No change needed</p>}
      {payload.choice && <p>{decisions[payload.choice]}{payload.changed === false ? ' · live value unchanged' : ''}</p>}
      {event.action === 'REASSIGNED' && <p>Assigned to {person(payload.assigneeId)}</p>}
      {event.action === 'CREATED' && <p>{payload.fields?.length || 0} fields flagged · Assigned to {person(payload.assigneeId)}</p>}
      {event.action === 'CREATED' && (payload.fieldSnapshots?.length ? <details>
        <summary>Field baselines when flagged</summary>
        {payload.fieldSnapshots.map(snapshot => {
          const recordedField = (flags.find(flag => flag.id === snapshot.flagId) || flags.find(flag => flag.fieldKey === snapshot.fieldKey))?.field;
          const label = snapshot.labelSnapshot || recordedField?.label || snapshot.fieldKey;
          return <div className="fr-history-entry" role="group" aria-label={'Flagged baseline for ' + label} key={snapshot.flagId || snapshot.fieldKey}>
            <strong>{label}</strong>
            <span>Value when flagged: {formatValue(snapshot.originalValue, recordedField)}</span>
            <span>Last edited by: {snapshot.originalLastEditedBy || 'Not recorded'}</span>
          </div>;
        })}
      </details> : <p className="fr-help">Last edited by was not recorded when these flags were raised.</p>)}
      {snapshots.some(([key]) => Object.hasOwn(payload, key)) && <details>
        <summary>Recorded values</summary>
        {snapshots.filter(([key]) => Object.hasOwn(payload, key)).map(([key, label]) => <p key={key}>
          <strong>{key === 'originalValue' && event.action === 'REOPENED' ? 'Value when reopened' : label}:</strong> {formatValue(payload[key], field)}
          {key === 'baselineValue' && event.action === 'SUBMITTED' && <small>Last edited by at baseline: {payload.baselineLastEditedBy || 'Not recorded'}</small>}
          {key === 'originalValue' && event.action === 'REOPENED' && <small>Last edited by when reopened: {payload.originalLastEditedBy || 'Not recorded'}</small>}
        </p>)}
      </details>}
    </div>;
  });
}
