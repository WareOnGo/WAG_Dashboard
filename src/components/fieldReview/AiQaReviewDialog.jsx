import { useEffect, useRef, useState } from 'react';
import { Alert, App, Button, Input, Modal, Spin, Tag } from 'antd';
import WarehouseDetailsModal from '../WarehouseDetailsModal';
import ResponsiveModal from '../ResponsiveModal';
import FieldReviewConfirmation from './FieldReviewConfirmation';
import { aiQaService } from '../../services/aiQaService';
import { initialReview, reviewPayload, snapshotWarehouse } from './aiQaReviewDraft';

const reasons = [
  ['INCORRECT', 'Incorrect flag — false positive'],
  ['INSUFFICIENT_EVIDENCE', 'Insufficient evidence'],
  ['NOT_ACTIONABLE', 'Not actionable'],
  ['DUPLICATE', 'Duplicate issue'],
  ['OUT_OF_SCOPE', 'Outside intended scope']
];
const raw = (value) =>
  value == null || value === '' ? '-' : typeof value === 'object' ? JSON.stringify(value) : String(value);

export default function AiQaReviewDialog({
  runId,
  whid,
  config,
  warehouse,
  sourceUnavailable = false,
  onClose,
  onSaved
}) {
  const { message, modal } = App.useApp();
  const [row, setRow] = useState(null);
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [assignee, setAssignee] = useState('');
  const [rejection, setRejection] = useState(null);
  const alive = useRef(false);
  const writing = useRef(false);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    aiQaService
      .detail(runId, whid, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setRow(data);
          setAssignee(data.assignment?.defaultAssigneeId ? String(data.assignment.defaultAssigneeId) : '');
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err.message);
      });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [runId, whid]);

  const retrying = row?.coverage.ai_status === 'RETRYING';
  useEffect(() => {
    if (!retrying) return;
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const updated = await aiQaService.detail(runId, whid, controller.signal);
        if (controller.signal.aborted) return;
        setRow((current) => (!current || updated.version >= current.version ? updated : current));
        if (updated.coverage.ai_status === 'RETRYING') timer = setTimeout(poll, 2000);
        else onSaved();
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message);
      }
    }
    timer = setTimeout(poll, 2000);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [retrying, runId, whid, onSaved]);

  async function save(operation, body) {
    if (writing.current || !row) return false;
    writing.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await aiQaService.mutate(runId, whid, operation, {
        ...body,
        expected_version: row.version
      });
      if (!alive.current) return false;
      setRow({ ...updated, events: row.events || [] });
      setDraft(null);
      setConflict(false);
      onSaved();
      aiQaService
        .detail(runId, whid)
        .then((detail) => {
          if (alive.current) setRow((current) => (detail.version >= current.version ? detail : current));
        })
        .catch(() => {});
      return true;
    } catch (err) {
      if (alive.current) {
        setError(err.message);
        if (err.status === 409) setConflict(true);
        if (err.code === 'QA_SOURCE_CHANGED') onSaved();
      }
      return false;
    } finally {
      writing.current = false;
      if (alive.current) setBusy(false);
    }
  }

  function close() {
    if (busy) return;
    if (draft)
      modal.confirm({
        title: 'Discard unsent flags?',
        content: 'Your selected fields and comments have not been submitted.',
        okText: 'Discard draft',
        cancelText: 'Keep editing',
        onOk: onClose
      });
    else onClose();
  }
  function reload() {
    modal.confirm({
      title: 'Reload this warehouse review?',
      content: 'This replaces your unsaved ticks and comments with the latest saved review.',
      okText: 'Reload and discard draft',
      cancelText: 'Keep editing',
      onOk: async () => {
        const updated = await aiQaService.detail(runId, whid);
        if (alive.current) {
          setRow(updated);
          setAssignee(
            updated.assignment?.defaultAssigneeId ? String(updated.assignment.defaultAssigneeId) : ''
          );
          setDraft(null);
          setConflict(false);
          setConfirm(false);
          setError('');
        }
      }
    });
  }

  if (!row)
    return (
      <ResponsiveModal visible title={`Warehouse #${whid}`} onClose={onClose} maxWidth="900px">
        {error ? (
          <Alert type="error" message={error} showIcon />
        ) : (
          <div className="fr-empty">
            <Spin />
          </div>
        )}
      </ResponsiveModal>
    );

  const outOfScope = row.eligible_for_review === false;
  const unavailable = sourceUnavailable || row.assignment?.unavailable;
  const frozen = outOfScope || row.stage !== 'AI_REVIEW' || unavailable;
  const policyChanged = row.execution_current === false || row.coverage.ai_status === 'POLICY_CHANGED';
  const incomplete = row.coverage.ai_status !== 'COMPLETED' || policyChanged;
  const live = config.handoff_mode === 'FIELD_REVIEW';
  const fields = config.registry.filter((field) => Object.hasOwn(row.fields, field.key));
  const candidates = new Map(row.candidates.map((candidate) => [candidate.field_key, candidate]));
  const current = draft || initialReview(row);
  const selected = fields.filter((field) => current[field.key]?.selected);
  const excluded = row.candidates.filter(
    (candidate) => candidate.source === 'MACHINE' && !current[candidate.field_key]?.selected
  );
  const assignees = row.assignment?.assignees || config.assignees || [];
  const eligibleAssignee = assignees.some((person) => person.id === Number(assignee));
  const duplicateFields = selected.filter((field) =>
    row.assignment?.activeFields?.some((active) => active.key === field.key)
  );

  function update(key, patch) {
    setDraft((previous) => {
      const value = previous || initialReview(row);
      return { ...value, [key]: { ...value[key], ...patch } };
    });
  }
  function reject(field) {
    setRejection({
      key: field.key,
      label: field.label,
      reason: current[field.key]?.reason || '',
      note: current[field.key]?.rejectionNote || ''
    });
  }
  function review() {
    if (duplicateFields.length) {
      setError(
        'Some selected fields already have an active review. Exclude duplicate AI flags or open the existing review.'
      );
      return;
    }
    if (selected.some((field) => !current[field.key].note?.trim())) {
      setError('Add a comment to every selected field.');
      return;
    }
    if (
      excluded.some(
        (candidate) =>
          !current[candidate.field_key].reason || !current[candidate.field_key].rejectionNote?.trim()
      )
    ) {
      setError('Add a rejection reason and comment to every excluded AI flag.');
      return;
    }
    setError('');
    setConfirm(true);
  }
  async function submit() {
    if (busy || frozen || incomplete || conflict) return;
    if (selected.length && !eligibleAssignee) {
      setError('Choose an active employee who can view this warehouse.');
      return;
    }
    if (
      await save('confirm', {
        assignee_id: selected.length ? Number(assignee) : null,
        review: reviewPayload(row, current)
      })
    ) {
      setConfirm(false);
      message.success(
        selected.length
          ? live
            ? 'Assigned to the employee review queue.'
            : 'Assignment staged.'
          : 'Review dismissed.'
      );
    }
  }

  const selection = {
    fields,
    activeFields: [],
    selected: selected.map((field) => field.key),
    comments: Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value.note || ''])),
    origins: Object.fromEntries(
      fields.map((field) => [field.key, candidates.get(field.key)?.source === 'MACHINE' ? 'ai' : 'human'])
    ),
    keepVisible: row.candidates.map((candidate) => candidate.field_key),
    disabled: busy || frozen || incomplete || conflict,
    toggle: (key, checked) => {
      if (!checked && candidates.get(key)?.source === 'MACHINE')
        reject(fields.find((field) => field.key === key));
      else update(key, { selected: checked, note: current[key]?.note || '' });
    },
    comment: (key, note) => update(key, { note }),
    renderDetails: (field) => {
      const candidate = candidates.get(field.key);
      const checked = !!current[field.key]?.selected;
      if (candidate?.source === 'MACHINE')
        return (
          <>
            {!checked && (
              <p className="fr-help">
                AI flag excluded · {reasons.find(([id]) => id === current[field.key]?.reason)?.[1]}
                {!frozen && (
                  <Button type="link" size="small" disabled={busy || conflict} onClick={() => reject(field)}>
                    Edit reason
                  </Button>
                )}
              </p>
            )}
            <details className="aiq-field-details">
              <summary>AI check details</summary>
              {candidate.findings.map((finding) => (
                <div key={finding.id} className="aiq-finding">
                  <p>{finding.explanation}</p>
                  <small>
                    {finding.executor === 'CODE' ? 'Deterministic' : 'AI text'} · {finding.rule_id} ·{' '}
                    {finding.case_code}
                  </small>
                  {finding.evidence.map((evidence, index) => (
                    <p key={index}>
                      <strong>{evidence.field_key}:</strong> {raw(evidence.value)}
                    </p>
                  ))}
                </div>
              ))}
              {!checked && <p>{current[field.key]?.rejectionNote}</p>}
            </details>
          </>
        );
      if (!checked) return null;
      const passed = row.checks.filter(
        (check) => check.review_field_key === field.key && check.verdict === 'GOOD'
      );
      return (
        <details className="aiq-field-details">
          <summary>Human flag feedback</summary>
          <label className="fr-label" htmlFor={'aiq-missed-' + field.key}>
            Which check missed this?
          </label>
          <select
            className="fr-input"
            id={'aiq-missed-' + field.key}
            value={current[field.key]?.missedRule || ''}
            disabled={selection.disabled}
            onChange={(event) => update(field.key, { missedRule: event.target.value })}
          >
            <option value="">Not covered / not evaluable — coverage gap</option>
            {passed.map((check) => (
              <option key={check.rule_id} value={check.rule_id}>
                {check.rule_id} passed — admin found a miss
              </option>
            ))}
          </select>
          <p className="fr-help">
            Only a miss linked to a passed check counts as an in-scope false negative.
          </p>
        </details>
      );
    }
  };

  const reviewButton = (
    <Button type="primary" disabled={busy || frozen || incomplete || conflict} onClick={review}>
      Review flags
    </Button>
  );
  const alert = error && (
    <Alert
      type="error"
      message={error}
      showIcon
      action={conflict && <Button onClick={reload}>Reload review</Button>}
    />
  );
  const banner = (
    <>
      <div className="fr-row">
        <Tag color="purple">AI flags</Tag>
        {!live && <Tag>Local sandbox</Tag>}
        <span className="fr-help">AI ticks · purple / Human ticks · yellow</span>
      </div>
      {unavailable ? (
        <Alert
          type="warning"
          message="The current source record is unavailable. You can read this saved review, but cannot assign it."
        />
      ) : outOfScope ? (
        <Alert
          type="info"
          message="This saved review is outside the current PEB-only QA scope. Its history is retained; approval and assignment are disabled."
        />
      ) : frozen ? (
        <Alert
          type="success"
          message={
            row.stage === 'ASSIGNED'
              ? 'Assigned to the employee review queue.'
              : row.stage === 'STALE'
                ? 'Warehouse evidence changed. This review is retained for history; use the fresh evaluation before assigning.'
                : row.stage === 'ASSIGNED_LOCAL'
                  ? 'Assigned locally; production handoff is staged.'
                  : row.stage === 'SUPERSEDED'
                    ? 'A newer QA evaluation replaced this review. Its original findings are kept here for history.'
                    : 'Dismissed locally.'
          }
        />
      ) : (
        <div className="fr-create-toolbar">
          <div>
            <strong>{selected.length} fields selected</strong>
            <p>AI suggestions are preselected. Adjust the ticks and comments before confirming.</p>
          </div>
          <div className="fr-row">{reviewButton}</div>
        </div>
      )}
      {alert}
      {row.handoff?.review_id && (
        <a href={'/field-reviews?review=' + row.handoff.review_id}>Open employee review</a>
      )}
      {row.assignment?.existingReviewId && !row.handoff?.review_id && (
        <p className="fr-help">
          This warehouse already has an assignee. Existing flags are preserved.{' '}
          <a href={'/field-reviews?review=' + row.assignment.existingReviewId}>Open existing review</a>
        </p>
      )}
      {policyChanged && !frozen && (
        <Alert
          type="warning"
          message="The QA rules changed since this evaluation. Run a new QA batch for this warehouse before assigning."
        />
      )}
      {!frozen && !policyChanged && row.coverage.ai_status === 'FAILED' && (
        <Alert
          type="warning"
          message="AI checks failed for this snapshot."
          action={
            <Button loading={busy} onClick={() => save('retry', {})}>
              Retry evaluation
            </Button>
          }
        />
      )}
      {retrying && <Alert type="info" message="Retrying evaluation for this saved snapshot…" />}
    </>
  );

  return (
    <>
      <WarehouseDetailsModal
        visible
        warehouse={snapshotWarehouse(row, warehouse)}
        onClose={close}
        enableFieldReview={false}
        snapshotOnly
        fieldReviewSelection={selection}
        statusBanner={banner}
        footerActions={!frozen && reviewButton}
        supplementalContent={
          <details className="aiq-diagnostics">
            <summary>QA coverage & activity</summary>
            <p className="fr-help">
              {row.checks.length} checks. {row.coverage.not_evaluated} not evaluated. Outside scope:{' '}
              {row.coverage.deferred.join('; ')}. Untouched fields are not counted as reviewed.
            </p>
            {row.checks.map((check) => (
              <div className="aiq-check" key={check.id}>
                <span>{check.verdict}</span>
                <div>
                  <strong>{check.rule_id}</strong> · {check.field_key}
                  <small>{check.case_code}</small>
                </div>
              </div>
            ))}
            {(row.events || []).map((event) => (
              <div className="fr-event" key={event.id}>
                <strong>{event.action.replaceAll('_', ' ')}</strong>
                <p>{event.actor}</p>
                <small>{new Date(event.created_at).toLocaleString('en-IN')}</small>
              </div>
            ))}
          </details>
        }
      />
      <Modal
        title={'Reject AI flag: ' + (rejection?.label || '')}
        open={!!rejection}
        destroyOnHidden
        onCancel={() => setRejection(null)}
        onOk={() => {
          update(rejection.key, {
            selected: false,
            reason: rejection.reason,
            rejectionNote: rejection.note.trim()
          });
          setRejection(null);
        }}
        okText="Exclude flag"
        okButtonProps={{ disabled: !rejection?.reason || !rejection?.note.trim() }}
      >
        <p>The original prediction is retained for evaluation. Add your reason for excluding it.</p>
        <label className="fr-label" htmlFor="aiq-reason">
          Rejection reason
        </label>
        <select
          className="fr-input"
          id="aiq-reason"
          value={rejection?.reason || ''}
          onChange={(event) => setRejection((value) => ({ ...value, reason: event.target.value }))}
        >
          <option value="">Choose a reason</option>
          {reasons.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <label className="fr-label" htmlFor="aiq-rejection-note">
          Review comment · required
        </label>
        <Input.TextArea
          id="aiq-rejection-note"
          value={rejection?.note || ''}
          onChange={(event) => setRejection((value) => ({ ...value, note: event.target.value }))}
          required
          maxLength={500}
          showCount
          autoSize={{ minRows: 2, maxRows: 4 }}
        />
      </Modal>
      <FieldReviewConfirmation
        warehouseId={whid}
        open={confirm}
        fields={selected.map((field) => ({
          ...field,
          value: row.fields[field.key],
          // The QA snapshot has no per-field editor identity. Do not substitute
          // today's warehouse editor or the QA runner for historical provenance.
          lastEditedBy: null,
          preserveRecordedUnits: true,
          comment: current[field.key].note,
          source: selection.origins[field.key]
        }))}
        assignees={assignees}
        assignee={assignee}
        onAssigneeChange={setAssignee}
        assigneeLocked={!!row.assignment?.existingReviewId}
        assignmentHelp={
          live
            ? 'Approved fields enter the employee review workflow. Existing review ownership is preserved.'
            : 'This saves a local assignment. It does not create production flags or notify an employee.'
        }
        saving={busy}
        confirmDisabled={frozen || incomplete || conflict || (selected.length > 0 && !eligibleAssignee)}
        onBack={() => setConfirm(false)}
        onConfirm={submit}
        confirmLabel={
          selected.length
            ? live
              ? 'Confirm & flag for review'
              : 'Confirm local assignment'
            : 'Dismiss review'
        }
        description="Review the selected fields and comments before confirming. Source shows whether a flag was suggested by AI or added by a human."
        feedback={alert}
      >
        {!!excluded.length && (
          <details className="aiq-diagnostics">
            <summary>{excluded.length} excluded AI flags</summary>
            {excluded.map((candidate) => (
              <p key={candidate.field_key}>
                <strong>{candidate.label}</strong> ·{' '}
                {reasons.find(([id]) => id === current[candidate.field_key].reason)?.[1]}
                <br />
                {current[candidate.field_key].rejectionNote}
              </p>
            ))}
          </details>
        )}
      </FieldReviewConfirmation>
    </>
  );
}
