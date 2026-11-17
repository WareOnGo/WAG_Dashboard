import { useEffect, useState } from 'react';
import { Alert, Button, Input, Modal, Tag } from 'antd';
import { fieldReviewService } from '../../services/fieldReviewService';
import FieldValueInput from './FieldValueInput';
import { formatValue, fromInput, STATUS_LABEL } from './values';
const time = value => value ? new Date(value).toLocaleString('en-IN') : '';
function EditHistory({
  reviewId,
  flag,
  revealed
}) {
  const [open, setOpen] = useState(false),
    [items, setItems] = useState(null),
    [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError('');
    fieldReviewService.history(reviewId, flag.id).then(r => {
      if (!cancelled) setItems(r.items);
    }).catch(e => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [open, reviewId, flag.id, flag.currentVersion, retry]);
  if (!flag.hasEditHistory) return <p className="fr-help">No edit history available.</p>;
  const rows = revealed?.history || items;
  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)}><summary>Edit history</summary>
  {error ? <><p role="alert">{error}</p><Button size="small" onClick={() => setRetry(n => n + 1)}>Retry history</Button></> : !rows ? <p>Loading history…</p> : rows.length ? rows.map(e => <div className="fr-history-entry" key={e.id}>
    {e.partLabel && <small>{e.partLabel} · recorded field</small>}
    <span>Before: {formatValue(e.oldValue, flag.field)}</span><strong>After: {formatValue(e.newValue, flag.field)}</strong>
    <small>{e.actorEmail || 'Editor not recorded'} · {time(e.createdAt)}</small><small>{e.source}</small>
   </div>) : <p>No edit history available.</p>}
  {rows?.length >= 100 && <p className="fr-help">Showing the latest 100 recorded edits.</p>}
 </details>;
}
export default function ReviewField({
  review,
  flag,
  draft,
  onDraft,
  onAction,
  busy,
  disabled = false,
  locationState
}) {
  const [localError, setLocalError] = useState('');
  const [revealReason, setRevealReason] = useState(''),
    [revealOpen, setRevealOpen] = useState(false);
  const [revealed, setRevealed] = useState(null),
    [revealing, setRevealing] = useState(false);
  const field = flag.field;
  // A newly fetched snapshot invalidates an older protected-value reveal.
  const activeReveal = revealed?.version === flag.version && revealed?.currentVersion === flag.currentVersion ? revealed : null;
  const values = activeReveal ? {
    ...flag,
    ...activeReveal
  } : flag;
  const masked = flag.valuesMasked && !activeReveal;
  const canEdit = review.canRespond && ['NEEDS_RESPONSE', 'CHANGES_REQUESTED'].includes(flag.status);
  const awaiting = flag.status === 'AWAITING_ADMIN';
  const staleDraft = canEdit && draft.baselineVersion !== flag.currentVersion;
  const valueCard = (label, value, help, history = false) => <div className="fr-value"><span>{label}</span><strong>{formatValue(value, field)}</strong>
  {help && <small>{help}</small>}{history && <EditHistory reviewId={review.id} flag={flag} revealed={activeReveal} />}</div>;
  const reveal = async () => {
    if (revealReason.trim().length < 3) {
      setLocalError('Give a reason for viewing the protected values.');
      return;
    }
    setRevealing(true);
    setLocalError('');
    try {
      setRevealed(await fieldReviewService.reveal(review.id, flag.id, revealReason.trim()));
      setRevealOpen(false);
    } catch (e) {
      setLocalError(e.message);
    } finally {
      setRevealing(false);
    }
  };
  const submit = async () => {
    setLocalError('');
    if (!draft.explanation.trim()) {
      setLocalError('Explain what you checked before submitting.');
      return;
    }
    try {
      const body = {
        version: flag.version,
        baselineVersion: draft.baselineVersion,
        resolution: draft.resolution,
        explanation: draft.explanation.trim()
      };
      if (draft.resolution === 'CORRECTION') body.proposedValue = fromInput(draft.proposed, field);
      await onAction('respond', flag, body);
    } catch (e) {
      setLocalError(e.message);
    }
  };
  const selected = draft.choice === 'CURRENT' ? values.currentValue : draft.choice === 'BASELINE' ? values.baselineValue : values.proposedValue;
  // Use the server's field-aware comparison (units, phone formats, set order).
  // Missing metadata fails closed until a refreshed response is available.
  const replacing = flag.replacementRequired?.[draft.choice] ?? (draft.choice !== 'CURRENT');
  const verify = async (confirmed = false) => {
    setLocalError('');
    if (flag.conflict && !draft.choice) return;
    if (flag.conflict && replacing && (!draft.reason.trim() || !confirmed)) {
      if (!draft.reason.trim()) {
        setLocalError('Add a reason before replacing the current value.');
        return;
      }
      onDraft({
        confirming: true,
        decisionVersion: flag.currentVersion
      });
      return;
    }
    await onAction('decide', flag, {
      version: flag.version,
      currentVersion: confirmed ? draft.decisionVersion : flag.currentVersion,
      choice: flag.conflict ? draft.choice : 'PROPOSED',
      ...(flag.conflict && replacing ? {
        reason: draft.reason.trim(),
        confirmed: true
      } : {})
    });
  };
  const returnResponse = async () => {
    setLocalError('');
    if (!draft.returnComment.trim()) {
      setLocalError('Explain what the employee should check.');
      return;
    }
    await onAction('returnForChanges', flag, {
      version: flag.version,
      comment: draft.returnComment.trim()
    });
  };
  const verification = review.events?.find(event => event.flagId === flag.id && event.action === 'VERIFIED');
  const noChangeOutcome = verification?.payload.changed === true ? 'Applied verified baseline'
    : verification?.payload.changed === false ? 'Verified · no change needed' : 'No-change response verified';
  const outcome = flag.decision === 'CURRENT' ? 'Kept current' : flag.decision === 'BASELINE' ? 'Restored baseline'
    : flag.resolution === 'NO_CHANGE' ? noChangeOutcome : 'Correction applied';
  return <article className="fr-field" data-status={flag.status} aria-labelledby={'fr-heading-' + flag.id}>
  <div className="fr-field-head"><div><span className="fr-section">{field.section}</span><h3 id={'fr-heading-' + flag.id}>{field.label}</h3></div>
   <Tag color={flag.status === 'VERIFIED' ? 'green' : awaiting ? 'purple' : 'orange'}>{STATUS_LABEL[flag.status]}</Tag></div>
  <p className="fr-current">Current warehouse value <strong>{formatValue(values.currentValue, field)}</strong></p>
  <div className="fr-comment"><small>{flag.createdBy || 'Admin not recorded'} · {time(flag.createdAt)}</small>{flag.comment}</div>
  {flag.valuesMasked && <Button size="small" style={{
      marginTop: 10
    }} onClick={() => setRevealOpen(true)}>{revealed ? 'Reveal latest values' : 'Reveal protected values'}</Button>}
  {flag.status === 'CHANGES_REQUESTED' && <Alert type="warning" showIcon message="Changes requested" description={flag.returnComment} />}
  {canEdit && <>
   {staleDraft && <Alert showIcon type="warning" message="The live value changed while you were preparing this response." description={<><p>Value you checked: {formatValue(draft.baselineValue, field)}. Current: {formatValue(values.currentValue, field)}.</p>
     <Button onClick={() => onDraft({
          baselineVersion: flag.currentVersion,
          baselineValue: flag.currentValue
        })}>Use the latest value as my baseline</Button></>} />}
   <div className="fr-response-choice" aria-label="Response type">
    <button disabled={disabled || busy} aria-pressed={draft.resolution === 'CORRECTION'} onClick={() => onDraft({
          resolution: 'CORRECTION'
        })}>Propose a correction</button>
    <button disabled={disabled || busy} aria-pressed={draft.resolution === 'NO_CHANGE'} onClick={() => onDraft({
          resolution: 'NO_CHANGE'
        })}>No change needed</button>
   </div>
   <div className="fr-editor"><div><label className="fr-label" htmlFor={'fr-proposal-' + flag.id}>{draft.resolution === 'NO_CHANGE' ? 'Value being verified' : 'Proposed ' + field.label}</label>
    {draft.resolution === 'NO_CHANGE' ? <p>{formatValue(values.currentValue, field)}</p> : <FieldValueInput id={'fr-proposal-' + flag.id} field={field} value={draft.proposed} warehouse={{ ...review.warehouse, state: locationState ?? review.warehouse?.state }} disabled={disabled || busy} onChange={proposed => onDraft({
            proposed
          })} />}
    <p className="fr-help">{field.type === 'integerList' ? 'Keep the order of floors or spaces. Add a separate value for each area.' : 'Warehouse values remain unchanged until verification.'}</p>
   </div><div><label className="fr-label" htmlFor={'fr-note-' + flag.id}>{draft.resolution === 'NO_CHANGE' ? 'How did you verify this? *' : 'Verification note *'}</label>
    <Input.TextArea id={'fr-note-' + flag.id} required aria-required="true" disabled={disabled || busy} value={draft.explanation} maxLength={500} showCount autoSize={{
            minRows: 3,
            maxRows: 6
          }} onChange={e => onDraft({
            explanation: e.target.value
          })} placeholder="Explain what you checked and with whom…" />
   </div></div>
   <div className="fr-actions"><p>The admin verifies before this flag closes.</p><div className="fr-row">
    <Button type="primary" loading={busy} disabled={disabled || staleDraft} onClick={submit}>Submit for verification</Button></div></div>
  </>}
  {awaiting && !review.canVerify && <>
   <div className="fr-values fr-two-values">{valueCard('Value checked', values.baselineValue)}
    {valueCard(flag.resolution === 'NO_CHANGE' ? 'No change needed' : 'Proposed value', values.proposedValue, 'Awaiting admin verification')}</div>
   <p>{flag.explanation}</p>{flag.conflict && <p className="fr-help">The live value changed after your response. The admin will compare the values before deciding.</p>}
  </>}
  {awaiting && review.canVerify && <>
   {flag.conflict && <Alert type="warning" showIcon message="The value changed while verification was pending." description="Compare Baseline, Proposed and Current, then choose which value to use." />}
   {field.type === 'availabilityReview' && <p className="fr-help">Availability and Last reviewed are verified together. Your choice applies both values.</p>}
   {field.type === 'handover' && <p className="fr-help">Your choice applies the selected timing type. Saved values for the other timing type stay unchanged.</p>}
   <div className={'fr-values ' + (!flag.conflict ? 'fr-two-values' : '')}>
    {flag.conflict && valueCard('Baseline', values.baselineValue, 'Value the employee checked')}
    {valueCard(flag.resolution === 'NO_CHANGE' ? 'Proposed · no change needed' : 'Proposed', values.proposedValue, 'Employee’s submitted response')}
    {valueCard('Current', values.currentValue, 'Live warehouse value now', flag.conflict)}
   </div><p><strong>{flag.respondedBy}:</strong> {flag.explanation}</p>
   {draft.returning ? <div className="fr-stack"><label className="fr-label" htmlFor={'fr-return-' + flag.id}>What should the employee check? *</label>
    <Input.TextArea id={'fr-return-' + flag.id} aria-required="true" maxLength={500} value={draft.returnComment} onChange={e => onDraft({
          returnComment: e.target.value
        })} />
    <div className="fr-row fr-end"><Button disabled={busy} onClick={() => onDraft({
            returning: false
    })}>Cancel</Button><Button disabled={disabled} loading={busy} onClick={returnResponse}>Return to employee</Button></div></div> : flag.conflict ? <>
     <fieldset className="fr-conflict-choices" disabled={disabled || busy || masked}><legend>Which value should be used?</legend>
      {[['CURRENT', 'Keep current', values.currentValue], ['PROPOSED', 'Apply proposed', values.proposedValue], ['BASELINE', 'Restore baseline', values.baselineValue]].map(([key, label, value]) => <label key={key}><input type="radio" name={'fr-choice-' + flag.id} checked={draft.choice === key} onChange={() => onDraft({
              choice: key,
              confirming: false
            })} /><span>{label}</span><strong>{formatValue(value, field)}</strong></label>)}
     </fieldset>
     {draft.choice && replacing && <><label className="fr-label" htmlFor={'fr-reason-' + flag.id}>Why replace the current value? *</label>
      <Input.TextArea id={'fr-reason-' + flag.id} required aria-required="true" maxLength={500} value={draft.reason} onChange={e => onDraft({
            reason: e.target.value
          })} /></>}
     <div className="fr-actions"><p>{draft.choice && !replacing ? 'Closes without changing the live value.' : 'Replacing current needs a reason and confirmation.'}</p>
      <div className="fr-row"><Button disabled={disabled || busy} onClick={() => onDraft({
              returning: true
            })}>Request changes</Button>
      <Button type="primary" disabled={disabled || !draft.choice || masked} loading={busy} onClick={() => verify()}>{replacing ? 'Review replacement' : draft.choice === 'CURRENT' ? 'Keep current & close' : 'Close with selected value'}</Button></div></div>
    </> : <div className="fr-actions"><p>Verify this response independently of the other flags.</p><div className="fr-row">
     <Button disabled={disabled || busy} onClick={() => onDraft({
            returning: true
          })}>Request changes</Button>
     <Button type="primary" disabled={disabled || masked} loading={busy} onClick={() => verify()}>{flag.resolution === 'NO_CHANGE' ? 'Verify & close' : 'Approve & close'}</Button></div></div>}
  </>}
  {flag.status === 'VERIFIED' && <>
   <div className="fr-actions"><strong>{formatValue(values.finalValue, field)}</strong><Tag color="green">{outcome}</Tag></div>
   <p>{flag.explanation}</p>{flag.decisionReason && <p>Admin reason: {flag.decisionReason}</p>}
   <p className="fr-help">Verified by {flag.decidedBy} · {time(flag.decidedAt)}</p>
   {review.canVerify && <Button disabled={disabled || busy} onClick={() => onDraft({
        reopening: true
      })}>Reopen flag</Button>}
  </>}
  {!canEdit && !awaiting && flag.status !== 'VERIFIED' && <p className="fr-help">Waiting for {review.assignee?.name || 'the assigned employee'} to respond.</p>}
  {localError && <Alert role="alert" type="error" showIcon message={localError} />}
  <Modal title="Confirm replacement of the current value" open={!!draft.confirming} onCancel={() => !busy && onDraft({
      confirming: false
    })} confirmLoading={busy} okButtonProps={{ disabled }} okText="Confirm replacement & close" onOk={() => verify(true)}>
   <p>This changes only <strong>{field.label}</strong> and closes its flag.</p>
   <div className="fr-values fr-two-values">{valueCard('Current', values.currentValue)}{valueCard('Replace with ' + (draft.choice === 'BASELINE' ? 'baseline' : 'proposed'), selected)}</div>
   <p><strong>Reason:</strong> {draft.reason}</p><p>The current value will be checked again when you confirm.</p>
  </Modal>
  <Modal title="Reopen this field?" open={!!draft.reopening} okText="Reopen flag" confirmLoading={busy} okButtonProps={{ disabled }} onCancel={() => onDraft({
      reopening: false
    })} onOk={() => onAction('reopen', flag, {
      version: flag.version
    })}>
   Start a new response against the current live value. Earlier verification stays in history. If this warehouse has another active review, the field joins that review and uses its current assignee.
  </Modal>
  <Modal title="Reveal protected review values" open={revealOpen} confirmLoading={revealing} okText="Reveal values" onCancel={() => setRevealOpen(false)} onOk={reveal}><label className="fr-label" htmlFor={'fr-reveal-' + flag.id}>Reason for access *</label>
   <Input.TextArea id={'fr-reveal-' + flag.id} value={revealReason} maxLength={500} onChange={e => setRevealReason(e.target.value)} />
   <p className="fr-help">This access is recorded in the review history.</p>{localError && <Alert type="error" message={localError} />}
  </Modal>
 </article>;
}
