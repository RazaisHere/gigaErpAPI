import { ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../auth/types/jwt-payload';
import {
  assertCollectionsReportAccess,
  assertStaff,
  departmentScopeId,
} from './reporting.scope';

function user(partial: Partial<RequestUser>): RequestUser {
  return {
    id: '1',
    name: 'T',
    email: 't@x.com',
    status: 'active',
    mustChangePassword: false,
    roleCode: 'employee',
    roleName: 'Employee',
    departmentId: '3',
    departmentCode: 'CCS',
    departmentName: 'Customer Care',
    isDepartmentAdmin: false,
    ...partial,
  };
}

describe('reporting.scope', () => {
  describe('assertStaff', () => {
    it('blocks clients', () => {
      expect(() =>
        assertStaff(user({ roleCode: 'client', departmentId: null })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('departmentScopeId', () => {
    it('returns null for superadmin (global)', () => {
      expect(
        departmentScopeId(
          user({ roleCode: 'superadmin', departmentId: null, departmentCode: null }),
        ),
      ).toBeNull();
    });

    it('returns department id for staff', () => {
      expect(departmentScopeId(user({ departmentId: '7' }))).toBe('7');
    });

    it('requires department for non-superadmin', () => {
      expect(() =>
        departmentScopeId(user({ departmentId: null })),
      ).toThrow(ForbiddenException);
    });
  });

  describe('assertCollectionsReportAccess', () => {
    it('allows superadmin and FIN/RCV', () => {
      expect(() =>
        assertCollectionsReportAccess(
          user({ roleCode: 'superadmin', departmentCode: null }),
        ),
      ).not.toThrow();
      expect(() =>
        assertCollectionsReportAccess(user({ departmentCode: 'FIN' })),
      ).not.toThrow();
      expect(() =>
        assertCollectionsReportAccess(user({ departmentCode: 'RCV' })),
      ).not.toThrow();
    });

    it('blocks CCS', () => {
      expect(() =>
        assertCollectionsReportAccess(user({ departmentCode: 'CCS' })),
      ).toThrow(ForbiddenException);
    });
  });
});
