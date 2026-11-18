import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, App, Button, Spin } from 'antd';
import { useAuth } from '../../contexts/AuthContext';
import { fieldReviewService } from '../../services/fieldReviewService';
import ResponsiveModal from '../ResponsiveModal';
import WarehouseDetailsModal from '../WarehouseDetailsModal';
import ReviewField from './ReviewField';
import { toInput } from './values';
import ReviewActivity from './ReviewActivity';
import './fieldReview.css';

// Session-only drafts survive closing this preview or opening another warehouse.
// Never put protected values or draft phone corrections into browser storage.
const sessionDrafts = new Map();
const initialDraft = flag => ({
  resolution: flag.status === 'CHANGES_REQUESTED' ? flag.resolution || 'CORRECTION' : 'CORRECTION',
  proposed: toInput(flag.status === 'CHANGES_REQUESTED' ? flag.proposedValue : flag.currentValue, flag.field, flag.valuesMasked),
  explanation: flag.status === 'CHANGES_REQUESTED' ? flag.explanation || '' : '',
  baselineVersion: flag.currentVersion,
  baselineValue: flag.currentValue,
  comparisonVersion: flag.currentVersion,
  choice: '',
  reason: '',
  returnComment: '',
  confirming: false,
  returning: false,
  version: flag.version
});
const draftFor = (flag, saved) => {
  if (saved?.version !== flag.version) return initialDraft(flag);
  if (saved.comparisonVersion === flag.currentVersion) return saved;
  // Preserve employee input and its original baseline, but a new live revision
  // requires a fresh admin choice, even after closing/reopening the preview.
  return { ...saved, comparisonVersion: flag.currentVersion, choice: '', reason: '', confirming: false, decisionVersion: undefined };
};
export default function FieldReviewDialog({
  reviewId,
  open,
  onClose,
  onChanged,
  onReviewIdChange
}) {
  const {
      user
    } = useAuth(),
    {
      message
    } = App.useApp();
  const [review, setReview] = useState(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(null);
  const [tab, setTab] = useState('flags'),
    [drafts, setDrafts] = useState({}),
    [busy, setBusy] = useState(null);
  const [assignee, setAssignee] = useState(''),
    [eventsLoading, setEventsLoading] = useState(false);
  const loadedReviewId = review?.id;
  const key = (user?.email || '') + ':' + reviewId,
    scroll = useRef({
      flags: 0,
      details: 0
    }),
    target = useRef(null),
    readGeneration = useRef(0),
    writing = useRef(null);
  // Reopening the same review is a new session: old promises must not match it.
  const scope = useMemo(() => ({ key, admin: user?.isAdmin, open }), [key, user?.isAdmin, open]);
  target.current = scope;
  useEffect(() => {
    target.current = scope;
    return () => { if (target.current === scope) target.current = null; };
  }, [scope]);
  const load = useCallback(async signal => {
    const generation = ++readGeneration.current;
    const current = () => !signal?.aborted && target.current === scope && generation === readGeneration.current;
    setLoading(true);
    setError(null);
    try {
      const r = await fieldReviewService.detail(reviewId, signal);
      if (!current()) return;
      setReview(r);
      setAssignee(r.assigneeId);
    } catch (e) {
      if (current()) {
        setError({ message: e.message });
        if (e.response?.status === 403) setReview(null);
      }
    } finally {
      if (current()) setLoading(false);
    }
  }, [reviewId, scope]);
  useEffect(() => {
    if (!open || !reviewId) return;
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [open, reviewId, load]);
  useEffect(() => {
    setReview(null);
    setBusy(null);
    setEventsLoading(false);
    setTab('flags');
    // Preserve entered text, but require a new explicit confirmation on reopen.
    setDrafts(Object.fromEntries(Object.entries(sessionDrafts.get(key) || {}).map(([id, draft]) =>
      [id, { ...draft, confirming: false, reopening: false }])));
    scroll.current = {
      flags: 0,
      details: 0
    };
  }, [key, scope]);
  useLayoutEffect(() => {
    if (!open || !loadedReviewId) return;
    const body = document.querySelector(tab === 'details' ? '.warehouse-details-modal .responsive-modal__body' : '.fr-modal .responsive-modal__body');
    if (body) body.scrollTop = scroll.current[tab];
  }, [tab, open, loadedReviewId]); // Layout state belongs to each tab, not to the warehouse values.
  const setDraft = (flag, patch) => {
    setDrafts(old => {
      const valid = draftFor(flag, old[flag.id]);
      const next = {
        ...old,
        [flag.id]: {
          ...valid,
          ...patch
        }
      };
      sessionDrafts.set(key, next);
      return next;
    });
  };
  const switchTab = next => {
    if (busy) return;
    const body = document.querySelector(tab === 'details' ? '.warehouse-details-modal .responsive-modal__body' : '.fr-modal .responsive-modal__body');
    if (body) scroll.current[tab] = body.scrollTop;
    if (next === 'details' && !review?.warehouse) return;
    setTab(next);
    requestAnimationFrame(() => document.querySelector('.fr-tabs button[aria-selected="true"]')?.focus({
      preventScroll: true
    }));
  };
  const tabs = <div className="fr-tabs" role="tablist" aria-label="Warehouse review preview" onKeyDown={e => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      switchTab(e.key === 'Home' ? 'flags' : e.key === 'End' ? 'details' : tab === 'flags' ? 'details' : 'flags');
    }
  }}>
  <button role="tab" aria-selected={tab === 'flags'} disabled={!!busy} onClick={() => switchTab('flags')}>Flagged fields {review?.flags.length ?? ''}</button>
  <button role="tab" aria-selected={tab === 'details'} disabled={!!busy || !review?.warehouse} onClick={() => switchTab('details')}>All details</button>
 </div>;
  const action = async (method, flag, body) => {
    if (writing.current === scope) return;
    writing.current = scope;
    ++readGeneration.current;
    setLoading(false);
    setBusy(flag.id);
    setError(null);
    try {
      const result = await fieldReviewService[method](review.id, flag.id, body);
      if (target.current !== scope) return;
      ++readGeneration.current;
      setReview(result);
      setDrafts(old => {
        const next = {
          ...old
        };
        delete next[flag.id];
        sessionDrafts.set(key, next);
        return next;
      });
      if (result.id !== reviewId) onReviewIdChange?.(result.id);
      onChanged?.();
      message.success(method === 'respond' ? 'Submitted for admin verification.' : method === 'decide' ? 'Field verified and closed.' : method === 'reopen' ? 'Flag reopened.' : 'Changes requested.');
    } catch (e) {
      if (target.current !== scope) return;
      // A refreshed comparison must require a fresh admin decision. Employee text
      // remains intact; its old baseline is shown until explicitly reconfirmed.
      const status = e.response?.status;
      if (status === 409 || status === 403) {
        if (method === 'decide') setDraft(flag, {
          choice: '',
          reason: '',
          confirming: false
        });
        await load();
      }
      if (target.current !== scope) return;
      setError({ message: e.message, flagId: flag.id });
    } finally {
      if (writing.current === scope) writing.current = null;
      if (target.current === scope) setBusy(null);
    }
  };
  const reassign = async () => {
    if (writing.current === scope) return;
    writing.current = scope;
    ++readGeneration.current;
    setLoading(false);
    setBusy('assignee');
    setError(null);
    try {
      const r = await fieldReviewService.reassign(review.id, {
        version: review.version,
        assigneeId: Number(assignee)
      });
      if (target.current !== scope) return;
      ++readGeneration.current;
      setReview(r);
      onChanged?.();
      message.success('Assignee updated. Earlier responses are preserved.');
    } catch (e) {
      if (target.current !== scope) return;
      if ([403, 409].includes(e.response?.status)) await load();
      if (target.current === scope) setError({ message: e.message });
    } finally {
      if (writing.current === scope) writing.current = null;
      if (target.current === scope) setBusy(null);
    }
  };
  const moreEvents = async () => {
    if (writing.current === scope || eventsLoading) return;
    const generation = readGeneration.current;
    const current = () => target.current === scope && generation === readGeneration.current;
    setEventsLoading(true);
    try {
      const r = await fieldReviewService.events(review.id, review.nextEventCursor);
      // A newer snapshot owns both the events and its pagination cursor.
      if (!current()) return;
      setReview(old => old ? ({
        ...old,
        events: [...new Map([...old.events, ...r.events].map(event => [event.id, event])).values()],
        nextEventCursor: r.nextEventCursor
      }) : old);
    } catch (e) {
      if (current()) setError({ message: e.message });
    } finally {
      if (target.current === scope) setEventsLoading(false);
    }
  };
  const active = review?.flags.filter(f => f.status !== 'VERIFIED').length || 0;
  const stateFlag = review?.flags.find(flag => flag.fieldKey === 'state' && flag.status !== 'VERIFIED');
  const stateDraft = stateFlag && drafts[stateFlag.id]?.version === stateFlag.version ? drafts[stateFlag.id] : null;
  const locationState = stateDraft?.resolution === 'CORRECTION' ? stateDraft.proposed
    : stateFlag?.status === 'AWAITING_ADMIN' && stateFlag.resolution === 'CORRECTION' ? stateFlag.proposedValue : review?.warehouse?.state;
  const footer = <div className="fr-actions" style={{
    width: '100%',
    margin: 0
  }}><span>{active} active {active === 1 ? 'flag' : 'flags'} · Live values change only after verification.</span><Button disabled={!!busy} onClick={onClose}>Back to queue</Button></div>;
  return <>
  <ResponsiveModal visible={open && tab === 'flags'} onClose={() => !busy && onClose()} title={review ? 'Warehouse #' + review.warehouseId + ' · ' + (review.canVerify ? 'Verify responses' : 'Flagged fields') : 'Field review'} className="fr-modal" maxWidth={review?.canVerify ? '1120px' : '900px'} footer={footer}>
   {tabs}{error && <Alert type="error" showIcon role="alert" message={error.message} action={<Button size="small" disabled={!!busy} onClick={() => load()}>Refresh</Button>} />}
   {loading && !review ? <div className="fr-empty"><Spin /><p>Loading review…</p></div> : review && <>
    {review.deleted && <Alert type="warning" message="This warehouse was deleted. Its review history is retained; further changes are disabled." />}
    {!review.deleted && !review.closedAt && review.assigneeCanRespond === false && <Alert type="warning" message="The assigned employee can no longer edit this warehouse. An admin must restore their access or reassign the review." />}
    <p className="fr-summary-count">Assigned to {review.assignee?.name || 'Employee unavailable'} · {active} active · {review.flags.length - active} closed</p>
    <div className={review.canVerify ? 'fr-layout' : ''}><div className="fr-fields">
     {review.flags.map(flag => <ReviewField key={flag.id} review={review} flag={flag} locationState={locationState} draft={draftFor(flag, drafts[flag.id])} onDraft={patch => setDraft(flag, patch)} onAction={action} actionError={error?.flagId === flag.id ? error.message : ''} busy={busy === flag.id} disabled={review.deleted || !!busy} />)}
    </div>{review.canVerify && <aside className="fr-aside"><h3>Review ownership</h3>
     <label className="fr-label" htmlFor="fr-detail-assignee">Assigned employee</label>
     <select id="fr-detail-assignee" className="fr-input" value={assignee} disabled={!!busy || review.deleted || !!review.closedAt} onChange={e => setAssignee(e.target.value)}>
      {!review.assignees?.some(p => p.id === Number(assignee)) && <option value={assignee}>{review.assignee?.name || 'Previous employee'} · unavailable</option>}
      {review.assignees?.map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
     </select><p className="fr-help">Original uploader: {review.warehouse?.uploadedBy || 'Unavailable'}</p>
     <Button disabled={!!busy || review.deleted || !!review.closedAt || Number(assignee) === review.assigneeId} onClick={reassign}>Update assignee</Button>
     <h3 style={{
              marginTop: 24
            }}>Flagged by</h3><p className="fr-help">{review.createdBy}</p><p className="fr-help">{new Date(review.createdAt).toLocaleString('en-IN')}</p>
    </aside>}</div>
    <details className="fr-events"><summary>Review activity and earlier responses</summary>
     <ReviewActivity events={review.events} flags={review.flags} people={review.assignees || [review.assignee].filter(Boolean)} />{review.nextEventCursor && <Button loading={eventsLoading} disabled={!!busy} onClick={moreEvents}>Load earlier activity</Button>}
    </details>
    {review.cycles?.length > 1 && <div><label className="fr-label" htmlFor="fr-cycle">Other review cycles for this warehouse</label>
     <select id="fr-cycle" className="fr-input" disabled={!!busy} value={review.id} onChange={e => onReviewIdChange?.(e.target.value)}>
      {review.cycles.map(c => <option key={c.id} value={c.id}>{new Date(c.createdAt).toLocaleString('en-IN')} · {c.closedAt ? 'Completed' : 'Current'}</option>)}
     </select></div>}
   </>}
  </ResponsiveModal>
  <WarehouseDetailsModal visible={open && tab === 'details'} onClose={onClose} warehouse={review?.warehouse} enableFieldReview={false} statusBanner={tabs} />
 </>;
}
