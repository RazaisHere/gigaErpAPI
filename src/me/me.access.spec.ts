import { ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { RequestUser } from '../auth/types/jwt-payload';
import { ClientLink } from '../clients/entities/client-link.entity';
import { resolveApprovedClientLink } from './me.access';

function user(partial: Partial<RequestUser> = {}): RequestUser {
  return {
    id: '17',
    name: 'Client',
    email: 'client.1@workspace.local',
    status: 'active',
    mustChangePassword: false,
    roleCode: 'client',
    roleName: 'Client',
    departmentId: null,
    departmentCode: null,
    departmentName: null,
    isDepartmentAdmin: false,
    ...partial,
  };
}

describe('resolveApprovedClientLink', () => {
  const findOne = jest.fn();
  const links = { findOne } as unknown as Repository<ClientLink>;

  beforeEach(() => {
    findOne.mockReset();
  });

  it('rejects non-client roles', async () => {
    await expect(
      resolveApprovedClientLink(links, user({ roleCode: 'superadmin' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('rejects missing link', async () => {
    findOne.mockResolvedValue(null);
    await expect(resolveApprovedClientLink(links, user())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects pending / non-approved', async () => {
    findOne.mockResolvedValue({
      id: '1',
      sourceClientId: 1,
      verificationStatus: 'pending',
    });
    await expect(resolveApprovedClientLink(links, user())).rejects.toThrow(
      /pending/i,
    );
  });

  it('returns sourceClientId when approved', async () => {
    findOne.mockResolvedValue({
      id: '9',
      sourceClientId: 5,
      verificationStatus: 'approved',
    });
    await expect(
      resolveApprovedClientLink(links, user({ id: '21' })),
    ).resolves.toEqual({
      linkId: '9',
      sourceClientId: 5,
      verificationStatus: 'approved',
    });
  });
});
