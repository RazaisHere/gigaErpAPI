import { ForbiddenException } from '@nestjs/common';
import { assertCollectionsAccess } from './collections.access';
import { RequestUser } from '../auth/types/jwt-payload';

function user(partial: Partial<RequestUser>): RequestUser {
  return {
    id: '1',
    name: 'T',
    email: 't@x.com',
    status: 'active',
    mustChangePassword: false,
    roleCode: 'employee',
    roleName: 'Employee',
    departmentId: '1',
    departmentCode: 'CCS',
    departmentName: 'Customer Care',
    isDepartmentAdmin: false,
    ...partial,
  };
}

describe('assertCollectionsAccess', () => {
  it('allows superadmin', () => {
    expect(() =>
      assertCollectionsAccess(user({ roleCode: 'superadmin', departmentCode: null })),
    ).not.toThrow();
  });

  it('allows FIN and RCV staff', () => {
    expect(() =>
      assertCollectionsAccess(user({ departmentCode: 'FIN' })),
    ).not.toThrow();
    expect(() =>
      assertCollectionsAccess(
        user({ roleCode: 'department_admin', departmentCode: 'RCV' }),
      ),
    ).not.toThrow();
  });

  it('blocks CCS and clients', () => {
    expect(() => assertCollectionsAccess(user({ departmentCode: 'CCS' }))).toThrow(
      ForbiddenException,
    );
    expect(() =>
      assertCollectionsAccess(
        user({ roleCode: 'client', departmentCode: null, departmentId: null }),
      ),
    ).toThrow(ForbiddenException);
  });
});
