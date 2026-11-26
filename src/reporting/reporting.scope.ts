import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../auth/types/jwt-payload';
import { COLLECTIONS_DEPARTMENT_CODES } from '../collections/collections.access';

export function assertStaff(user: RequestUser) {
  if (!['superadmin', 'department_admin', 'employee'].includes(user.roleCode)) {
    throw new ForbiddenException('Insufficient role');
  }
}

/** Superadmin sees all; others are limited to their department id. */
export function departmentScopeId(user: RequestUser): string | null {
  assertStaff(user);
  if (user.roleCode === 'superadmin') return null;
  if (!user.departmentId) {
    throw new ForbiddenException('No department assigned');
  }
  return user.departmentId;
}

export function assertAuditAccess(user: RequestUser) {
  assertStaff(user);
  // Superadmin: full audit. Dept staff: own department only (enforced in query).
}

export function assertCollectionsReportAccess(user: RequestUser) {
  assertStaff(user);
  if (user.roleCode === 'superadmin') return;
  if (
    user.departmentCode &&
    COLLECTIONS_DEPARTMENT_CODES.has(user.departmentCode)
  ) {
    return;
  }
  throw new ForbiddenException(
    'Collections report is limited to Finance and Recovery staff (or superadmin)',
  );
}

export const OPEN_CASE_STATUSES = [
  'New',
  'Assigned',
  'In Progress',
  'Waiting on Client',
  'Handed Off',
  'Reopened',
];

export const CLOSED_CASE_STATUSES = ['Resolved', 'Closed'];
