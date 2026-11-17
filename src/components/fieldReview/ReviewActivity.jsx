import { formatValue } from './values';
const actions = {
  CREATED: 'Flagged for review',
  SUBMITTED: 'Response submitted',
  VERIFIED: 'Verified and closed',
  RETURNED: 'Changes requested',
  REOPENED: 'Flag reopened',
  REASSIGNED: 'Assignee changed',
  REVEALED: 'Protected values viewed'
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
    const person = id => people.find(p => p.id === id)?.name || 'Previously assigned employee';
    return <div className="fr-event" key={event.id}>
      <strong>{actions[event.action] || 'Review updated'}{field ? ' · ' + field.label : ''}</strong>
      <small>{event.actorName || event.actorEmail} · {new Date(event.createdAt).toLocaleString('en-IN')}</small>
      {payload.explanation && <p>{payload.explanation}</p>}
      {payload.comment && <p>{payload.comment}</p>}
      {payload.reason && <p>Reason: {payload.reason}</p>}
      {payload.resolution === 'NO_CHANGE' && <p>No change needed</p>}
      {payload.choice && <p>{decisions[payload.choice]}{payload.changed === false ? ' · live value unchanged' : ''}</p>}
      {event.action === 'REASSIGNED' && <p>Assigned to {person(payload.assigneeId)}</p>}
      {event.action === 'CREATED' && <p>{payload.fields?.length || 0} fields flagged · Assigned to {person(payload.assigneeId)}</p>}
      {snapshots.some(([key]) => Object.hasOwn(payload, key)) && <details>
        <summary>Recorded values</summary>
        {snapshots.filter(([key]) => Object.hasOwn(payload, key)).map(([key, label]) => <p key={key}><strong>{label}:</strong> {formatValue(payload[key], field)}</p>)}
      </details>}
    </div>;
  });
}
