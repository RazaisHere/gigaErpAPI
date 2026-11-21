import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { CognitoService } from '../cognito/cognito.service';
import { ClientLink } from '../clients/entities/client-link.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { ClientSignupService } from './client-signup.service';
import { PendingClientSignup } from './entities/pending-client-signup.entity';

jest.mock('./utils/password.util', () => ({
  hashPassword: jest.fn().mockResolvedValue('hashed'),
}));

describe('ClientSignupService', () => {
  let service: ClientSignupService;
  let pending: Record<string, jest.Mock>;
  let users: Record<string, jest.Mock>;
  let roles: Record<string, jest.Mock>;
  let userRoles: Record<string, jest.Mock>;
  let links: Record<string, jest.Mock>;
  let source: { query: jest.Mock };
  let cognito: Record<string, jest.Mock>;

  beforeEach(() => {
    pending = {
      findOne: jest.fn(),
      save: jest.fn(async (x: unknown) => x),
      create: jest.fn((x: unknown) => x),
      delete: jest.fn(),
    };
    users = {
      findOne: jest.fn(),
      save: jest.fn(async (x: object) => ({ ...x, id: '99' })),
      create: jest.fn((x: unknown) => x),
    };
    roles = {
      findOne: jest.fn().mockResolvedValue({ id: '4', code: 'client' }),
    };
    userRoles = {
      save: jest.fn(async (x: unknown) => x),
      create: jest.fn((x: unknown) => x),
    };
    links = {
      findOne: jest.fn(),
      save: jest.fn(async (x: object) => ({ ...x, id: '1' })),
      create: jest.fn((x: unknown) => x),
    };
    source = { query: jest.fn() };
    cognito = {
      isConfigured: jest.fn().mockReturnValue(true),
      signUp: jest.fn().mockResolvedValue({ userConfirmed: false }),
      confirmSignUp: jest.fn().mockResolvedValue(undefined),
      resendConfirmationCode: jest.fn().mockResolvedValue(undefined),
      getUserSub: jest.fn().mockResolvedValue('sub-abc'),
    };

    service = new ClientSignupService(
      pending as unknown as Repository<PendingClientSignup>,
      users as unknown as Repository<User>,
      roles as unknown as Repository<Role>,
      userRoles as unknown as Repository<UserRole>,
      links as unknown as Repository<ClientLink>,
      source as unknown as DataSource,
      cognito as unknown as CognitoService,
    );
  });

  describe('register', () => {
    it('rejects when Cognito is not configured', async () => {
      cognito.isConfigured.mockReturnValue(false);
      await expect(
        service.register({
          email: 'a@b.com',
          password: 'Workspace@123',
          cnic: '21104-4733982-1',
          phone: '0341-5813388',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when ERP client is not found', async () => {
      source.query.mockResolvedValue([]);
      await expect(
        service.register({
          email: 'a@b.com',
          password: 'Workspace@123',
          cnic: '21104-4733982-1',
          phone: '0341-5813388',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('matches by CNIC and calls Cognito SignUp', async () => {
      source.query.mockResolvedValue([
        {
          id: 6,
          person: 'KIFYATULLAH',
          email: null,
          mobile_number: '0341 5813388',
          cnic: '21104-4733982-1',
        },
      ]);
      users.findOne.mockResolvedValue(null);
      links.findOne.mockResolvedValue(null);
      pending.findOne.mockResolvedValue(null);

      const result = await service.register({
        email: 'kifyat@example.com',
        password: 'Workspace@123',
        cnic: '21104-4733982-1',
        phone: '0341-5813388',
      });

      expect(cognito.signUp).toHaveBeenCalled();
      expect(result.sourceClientId).toBe(6);
      expect(result.ok).toBe(true);
    });

    it('rejects when email already registered', async () => {
      source.query.mockResolvedValue([
        {
          id: 6,
          person: 'KIFYATULLAH',
          mobile_number: null,
          cnic: '21104-4733982-1',
        },
      ]);
      users.findOne.mockResolvedValue({ id: '1' });

      await expect(
        service.register({
          email: 'taken@example.com',
          password: 'Workspace@123',
          cnic: '21104-4733982-1',
          phone: '0341-5813388',
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('confirm', () => {
    it('creates user + pending client_link after Cognito confirm', async () => {
      pending.findOne.mockResolvedValue({
        id: '10',
        email: 'kifyat@example.com',
        phone: '0341-5813388',
        cnic: '21104-4733982-1',
        sourceClientId: 6,
        clientName: 'KIFYATULLAH',
        passwordHash: 'hashed',
        expiresAt: new Date(Date.now() + 60_000),
      });
      users.findOne.mockResolvedValue(null);
      links.findOne.mockResolvedValue(null);

      const result = await service.confirm({
        email: 'kifyat@example.com',
        code: '123456',
      });

      expect(cognito.confirmSignUp).toHaveBeenCalledWith(
        'kifyat@example.com',
        '123456',
      );
      expect(users.save).toHaveBeenCalled();
      expect(links.save).toHaveBeenCalled();
      expect(result.verificationStatus).toBe('pending');
      expect(pending.delete).toHaveBeenCalled();
    });

    it('rejects expired pending signup', async () => {
      pending.findOne.mockResolvedValue({
        id: '10',
        email: 'kifyat@example.com',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.confirm({ email: 'kifyat@example.com', code: '1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
