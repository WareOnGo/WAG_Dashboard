export const AI_QA_STAGES = [
  { value: 'AI_REVIEW', label: 'Pending review', color: 'purple' },
  { value: 'ASSIGNED_LOCAL', label: 'Approved for assignment', color: 'green' },
  { value: 'ASSIGNED', label: 'Assigned to employee', color: 'green' },
  { value: 'STALE', label: 'Needs fresh evaluation', color: 'orange' },
  { value: 'DISMISSED', label: 'Dismissed', color: 'default' },
  { value: 'SUPERSEDED', label: 'Previous evaluation', color: 'default' }
];

export const aiQaStage = (value) =>
  AI_QA_STAGES.find((stage) => stage.value === value) || { label: 'Unknown stage', color: 'default' };
