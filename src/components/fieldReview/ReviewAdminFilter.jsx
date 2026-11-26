import { useId } from 'react';
import { Select } from 'antd';

export default function ReviewAdminFilter({ label, value, onChange, reviewers, loading }) {
  const id = useId();
  return <div className="fr-queue-review-filter">
    <label htmlFor={id}>{label}</label>
    <Select id={id} aria-label="Filter by admin or reviewer" placeholder="All admins / reviewers"
      allowClear showSearch optionFilterProp="label" loading={loading}
      value={value || undefined} onChange={next => onChange(next || '')}
      options={reviewers.map(person => ({ value: person.email,
        label: person.name === person.email ? person.email : `${person.name} (${person.email})` }))} />
  </div>;
}
