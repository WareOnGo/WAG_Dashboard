import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, App, Button } from 'antd';
import { FlagOutlined } from '@ant-design/icons';
import AuthContext from '../../contexts/AuthContext';
import { fieldReviewService } from '../../services/fieldReviewService';
import { canManageFieldReviews, fieldReviewAccessKey } from '../../utils/fieldReviewPermissions';
import FieldReviewConfirmation from './FieldReviewConfirmation';
import './fieldReview.css';
export default function useFieldReviewCreation({ warehouse, visible, onClose, enabled = true }) {
  const auth = useContext(AuthContext);
  const { modal, message } = App.useApp();
  const [setup, setSetup] = useState(null),
    [selected, setSelected] = useState([]),
    [comments, setComments] = useState({});
  const [assignee, setAssignee] = useState(''),
    [loading, setLoading] = useState(false),
    [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState(false),
    [error, setError] = useState('');
  const request = useRef(null);
  const accessKey = fieldReviewAccessKey(auth?.user);
  const canCreate = enabled && canManageFieldReviews(auth?.user) && Number.isInteger(warehouse?.id);
  const eligibleAssignee = setup?.assignees?.some((person) => person.id === Number(assignee));
  useEffect(() => {
    request.current = null;
    setSetup(null);
    setSelected([]);
    setComments({});
    setAssignee('');
    setConfirm(false);
    setError('');
    setLoading(false);
    setSaving(false);
    return () => {
      request.current = null;
    };
  }, [warehouse?.id, visible, accessKey, canCreate]);
  const discard = (next) => {
    if (selected.length)
      modal.confirm({
        title: 'Discard unsent flags?',
        content: 'Your selected fields and comments have not been submitted.',
        okText: 'Discard draft',
        cancelText: 'Keep editing',
        onOk: next
      });
    else next();
  };
  const cancel = () =>
    discard(() => {
      setSetup(null);
      setSelected([]);
      setConfirm(false);
      setError('');
    });
  const close = () => {
    if (!saving) discard(onClose);
  };
  const start = async () => {
    const current = {};
    request.current = current;
    setLoading(true);
    setError('');
    try {
      const data = await fieldReviewService.setup(warehouse.id);
      if (current !== request.current) return;
      setSetup(data);
      setAssignee(data.defaultAssigneeId ?? '');
    } catch (e) {
      if (current === request.current) setError(e.message);
    } finally {
      if (current === request.current) setLoading(false);
    }
  };
  const review = () => {
    if (!selected.length) return;
    if (selected.some((k) => !comments[k]?.trim())) {
      setError('Add a comment to every selected field.');
      return;
    }
    setError('');
    setConfirm(true);
  };
  const submit = async () => {
    if (!canCreate || saving) return;
    if (!eligibleAssignee) {
      setError('Select an eligible employee before confirming.');
      return;
    }
    const current = request.current;
    setSaving(true);
    setError('');
    try {
      await fieldReviewService.create({
        warehouseId: warehouse.id,
        assigneeId: Number(assignee),
        fields: selected.map((key) => ({
          key,
          comment: comments[key].trim()
        }))
      });
      if (current !== request.current) return;
      setSetup(null);
      setSelected([]);
      setConfirm(false);
      message.success('Flagged for review. Warehouse values are unchanged.');
    } catch (e) {
      if (current === request.current) setError(e.message);
    } finally {
      if (current === request.current) setSaving(false);
    }
  };
  const toolbar = canCreate ? (
    <div className="fr-create-toolbar">
      {setup ? (
        <>
          <div>
            <strong>{selected.length} fields selected</strong>
            <p>Select editable fields and explain what needs checking.</p>
            {setup.existingReviewId && (
              <a href={'/field-reviews?review=' + setup.existingReviewId}>Open the existing review</a>
            )}
          </div>
          <div className="fr-row">
            <Button onClick={cancel}>Cancel flagging</Button>
            <Button type="primary" disabled={!selected.length} onClick={review}>
              Review flags
            </Button>
          </div>
        </>
      ) : (
        <Button icon={<FlagOutlined aria-hidden="true" />} loading={loading} onClick={start}>
          Flag for review (beta)
        </Button>
      )}
      {error && !confirm && <Alert type="error" message={error} showIcon />}
    </div>
  ) : null;
  // Keep the confirmation within this details session. Let Modal finish closing
  // so it restores keyboard focus, then remove its portal before the next use.
  const summary =
    canCreate && visible ? (
      <FieldReviewConfirmation
        warehouseId={warehouse.id}
        open={confirm}
        fields={selected.map((key) => ({
          ...setup?.fields.find((field) => field.key === key),
          key,
          comment: comments[key],
          source: 'human'
        }))}
        assignees={setup?.assignees}
        assignee={assignee}
        onAssigneeChange={setAssignee}
        assigneeLocked={!!setup?.existingReviewId}
        assignmentHelp={
          setup?.existingReviewId
            ? 'Keeps the current review’s assignee. Change ownership from its review screen.'
            : 'Defaults to the original uploader: ' +
              (setup?.uploader || 'Unknown') +
              '. You can change this.'
        }
        saving={saving}
        confirmDisabled={!eligibleAssignee}
        onBack={() => setConfirm(false)}
        onConfirm={submit}
        feedback={
          <>
            {setup?.existingReviewId && !eligibleAssignee && (
              <Alert
                type="warning"
                showIcon
                message="The current assignee cannot respond to this warehouse."
                description={
                  <a href={'/field-reviews?review=' + setup.existingReviewId}>
                    Open the existing review to change its assignee.
                  </a>
                }
              />
            )}
            {error && <Alert role="alert" type="error" message={error} showIcon />}
          </>
        }
      />
    ) : null;
  return {
    toolbar,
    summary,
    onClose: canCreate ? close : onClose,
    selection:
      canCreate && visible && setup
        ? {
            ...setup,
            selected,
            comments,
            toggle: (key, on) =>
              setSelected((old) => (on ? [...new Set([...old, key])] : old.filter((k) => k !== key))),
            comment: (key, text) =>
              setComments((old) => ({
                ...old,
                [key]: text
              }))
          }
        : null
  };
}
