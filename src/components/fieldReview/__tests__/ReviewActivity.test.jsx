import { fireEvent, render, screen, within } from '@testing-library/react';
import ReviewActivity from '../ReviewActivity';

const flags = [{ id: 'area-flag', fieldKey: 'totalSpaceSqft', currentValue: [60000], lastEditedBy: 'current@wareongo.com',
  field: { key: 'totalSpaceSqft', label: 'Current area label', type: 'integerList' } },
{ id: 'contact-flag', fieldKey: 'contactPerson', field: { key: 'contactPerson', label: 'Contact Person', type: 'text' } }];
const people = [{ id: 2, name: 'Assigned employee' }];
const event = (action, payload, id = action) => ({ id, action, actorEmail: 'reviewer@wareongo.com',
  actorName: 'Reviewer', createdAt: '2026-11-19T12:00:00Z', payload });

it('shows saved per-field baselines and editor identities independently of live warehouse data', () => {
  render(<ReviewActivity flags={flags} people={people} events={[event('CREATED', {
    fields: ['totalSpaceSqft', 'contactPerson'], assigneeId: 2, fieldSnapshots: [
      { flagId: 'area-flag', fieldKey: 'totalSpaceSqft', labelSnapshot: 'Area when flagged', originalValue: [50000], originalVersion: 3, originalLastEditedBy: 'area-editor@wareongo.com' },
      { flagId: 'contact-flag', fieldKey: 'contactPerson', labelSnapshot: 'Contact Person', originalValue: 'Warehouse contact', originalVersion: 0, originalLastEditedBy: 'Original creator' },
    ],
  })]} />);
  fireEvent.click(screen.getByText('Field baselines when flagged'));
  const area = screen.getByRole('group', { name: 'Flagged baseline for Area when flagged' });
  expect(area).toHaveTextContent('Value when flagged: 50,000');
  expect(area).toHaveTextContent('Last edited by: area-editor@wareongo.com');
  expect(screen.getByRole('group', { name: 'Flagged baseline for Contact Person' })).toHaveTextContent('Last edited by: Original creator');
  expect(screen.queryByText(/current@wareongo.com|60,000|Current area label/)).not.toBeInTheDocument();
});

it('keeps submitted and reopened baseline attribution distinct, including explicit unknown editors', () => {
  render(<ReviewActivity flags={flags} people={people} events={[
    event('SUBMITTED', { fieldKey: 'totalSpaceSqft', labelSnapshot: 'Area when checked', baselineValue: [51000], baselineLastEditedBy: 'baseline@wareongo.com', proposedValue: [48000] }),
    event('REOPENED', { fieldKey: 'totalSpaceSqft', originalValue: [48000], originalLastEditedBy: 'approver@wareongo.com' }),
    event('SUBMITTED', { fieldKey: 'contactPerson', baselineValue: 'A contact', baselineLastEditedBy: null }, 'missing-actor'),
  ]} />);
  for (const summary of screen.getAllByText('Recorded values')) fireEvent.click(summary);
  expect(screen.getByText('Response submitted · Area when checked')).toBeInTheDocument();
  expect(screen.getByText('Last edited by at baseline: baseline@wareongo.com')).toBeVisible();
  expect(screen.getByText('Value when reopened:')).toBeVisible();
  expect(screen.getByText('Last edited by when reopened: approver@wareongo.com')).toBeVisible();
  expect(screen.getByText('Last edited by at baseline: Not recorded')).toBeVisible();
});

it('handles legacy events and missing historical editors without substituting a current editor', () => {
  render(<ReviewActivity flags={flags} people={people} events={[
    event('CREATED', { fields: ['totalSpaceSqft'], assigneeId: 2 }, 'legacy'),
    event('CREATED', { fields: ['contactPerson'], fieldSnapshots: [{ fieldKey: 'contactPerson', originalValue: null, originalLastEditedBy: null }] }, 'unknown'),
    event('SUBMITTED', { fieldKey: 'totalSpaceSqft', baselineValue: [50000] }),
  ]} />);
  expect(screen.getByText('Last edited by was not recorded when these flags were raised.')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Field baselines when flagged'));
  const contact = screen.getByRole('group', { name: 'Flagged baseline for Contact Person' });
  expect(within(contact).getByText('Last edited by: Not recorded')).toBeVisible();
  fireEvent.click(screen.getByText('Recorded values'));
  expect(screen.getByText('Last edited by at baseline: Not recorded')).toBeVisible();
  expect(screen.queryByText(/current@wareongo.com/)).not.toBeInTheDocument();
});

it('records cancellation separately from verification, with its reviewer and reason', () => {
  render(<ReviewActivity flags={flags} people={people} events={[event('CANCELLED', {
    fieldKey: 'totalSpaceSqft', labelSnapshot: 'Offered Area', reason: 'Raised against an old photo.', currentValue: [50000],
  })]} />);
  expect(screen.getByText('Flag cancelled · Offered Area')).toBeInTheDocument();
  expect(screen.getByText('Reason: Raised against an old photo.')).toBeInTheDocument();
  expect(screen.getByText('Warehouse value unchanged.')).toBeInTheDocument();
  expect(screen.queryByText(/Verified and closed|Applied proposed/)).not.toBeInTheDocument();
});
