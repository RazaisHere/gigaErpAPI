/** Allowed status transitions for workspace cases. */
export const CASE_STATUSES = [
  'New',
  'Assigned',
  'In Progress',
  'Waiting on Client',
  'Handed Off',
  'Resolved',
  'Closed',
  'Reopened',
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

const ALLOWED: Record<string, string[]> = {
  New: ['Assigned', 'In Progress', 'Handed Off', 'Closed'],
  Assigned: ['In Progress', 'Waiting on Client', 'Handed Off', 'Resolved'],
  'In Progress': [
    'Assigned',
    'Waiting on Client',
    'Handed Off',
    'Resolved',
  ],
  'Waiting on Client': ['In Progress', 'Handed Off', 'Resolved'],
  'Handed Off': ['Assigned', 'In Progress', 'Waiting on Client'],
  Resolved: ['Closed', 'Reopened'],
  Closed: ['Reopened'],
  Reopened: ['Assigned', 'In Progress', 'Handed Off', 'Resolved'],
};

export function canTransition(from: string, to: string): boolean {
  if (from === to) return true;
  return (ALLOWED[from] ?? []).includes(to);
}

export const CASE_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];
