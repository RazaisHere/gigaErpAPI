import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../auth/types/jwt-payload';

/** Briefing: Collections nav for dept admins only when FIN or RCV. */
export const COLLECTIONS_DEPARTMENT_CODES = new Set(['FIN', 'RCV']);

export function assertCollectionsAccess(user: RequestUser): void {
  if (user.roleCode === 'superadmin') return;

  if (
    (user.roleCode === 'department_admin' || user.roleCode === 'employee') &&
    user.departmentCode &&
    COLLECTIONS_DEPARTMENT_CODES.has(user.departmentCode)
  ) {
    return;
  }

  throw new ForbiddenException(
    'Collections is limited to Finance and Recovery staff (or superadmin)',
  );
}
