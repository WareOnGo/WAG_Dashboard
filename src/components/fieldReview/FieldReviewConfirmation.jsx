import { useId } from 'react';
import { Button, Modal, Tag } from 'antd';
import { formatValue } from './values';
import MediaReviewValue from './MediaReviewValue';
import './fieldReview.css';

// Presentation only: callers retain their drafts, permissions and save endpoint.
export default function FieldReviewConfirmation({
  warehouseId,
  open,
  fields,
  assignees = [],
  assignee,
  onAssigneeChange,
  assigneeLocked = false,
  assignmentHelp,
  saving = false,
  confirmDisabled = false,
  onBack,
  onConfirm,
  confirmLabel = 'Confirm & flag for review',
  description = 'The assigned employee can respond to these flagged fields without Edit permission. Each response requires reviewer verification.',
  children,
  feedback
}) {
  const assigneeId = useId();
  const back = () => {
    if (!saving) onBack();
  };

  return (
    <Modal
      className="fr-confirmation"
      title={'Confirm flags for warehouse #' + warehouseId}
      open={open}
      destroyOnHidden
      onCancel={back}
      width={960}
      footer={
        <div className="fr-row fr-end">
          <Button disabled={saving} onClick={back}>
            Back to fields
          </Button>
          <Button type="primary" loading={saving} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description && <p>{description}</p>}
      {fields.length ? (
        <div className="fr-table-scroll" role="region" aria-label="Selected fields for review" tabIndex={0}>
          <table className="fr-summary fr-confirmation-summary">
            <colgroup>
              <col />
              <col />
              <col />
              <col className="fr-summary-source-column" />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th scope="col">Field</th>
                <th scope="col">Current value</th>
                <th scope="col">Last edited by</th>
                <th scope="col">Source</th>
                <th scope="col">Review comment</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.key}>
                  <th scope="row">{field.label}</th>
                  <td>
                    {field.type === 'media' ? (
                      <MediaReviewValue value={field.value} />
                    ) : (
                      formatValue(field.value, field)
                    )}
                  </td>
                  <td>{field.lastEditedBy || 'Not recorded'}</td>
                  <td>
                    <Tag className={field.source === 'ai' ? 'fr-origin-ai' : 'fr-origin-human'}>
                      {field.source === 'ai' ? 'AI' : 'Human'}
                    </Tag>
                  </td>
                  <td>{field.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No fields selected for assignment.</p>
      )}
      {children}
      {!!fields.length && (
        <>
          <label htmlFor={assigneeId} className="fr-label">
            Assign review to
          </label>
          <select
            id={assigneeId}
            className="fr-input"
            value={assignee}
            disabled={saving || assigneeLocked}
            onChange={(event) => onAssigneeChange(event.target.value)}
          >
            <option value="">Select an employee</option>
            {assignees.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.email ? ' · ' + person.email : ''}
              </option>
            ))}
          </select>
        </>
      )}
      {assignmentHelp && <p className="fr-help">{assignmentHelp}</p>}
      {feedback}
    </Modal>
  );
}
