import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CognitoService } from '../cognito/cognito.service';
import { ClientLink } from '../clients/entities/client-link.entity';
import { Role } from '../users/entities/role.entity';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../users/entities/user-role.entity';
import { ClientConfirmDto } from './dto/client-confirm.dto';
import { ClientRegisterDto } from './dto/client-register.dto';
import { PendingClientSignup } from './entities/pending-client-signup.entity';
import { hashPassword } from './utils/password.util';

type SrcClientMatch = {
  id: number;
  person: string | null;
  email: string | null;
  mobile_number: string | null;
  cnic: string | null;
};

const PENDING_TTL_HOURS = 24;

@Injectable()
export class ClientSignupService {
  constructor(
    @InjectRepository(PendingClientSignup, 'workspace')
    private readonly pending: Repository<PendingClientSignup>,
    @InjectRepository(User, 'workspace')
    private readonly users: Repository<User>,
    @InjectRepository(Role, 'workspace')
    private readonly roles: Repository<Role>,
    @InjectRepository(UserRole, 'workspace')
    private readonly userRoles: Repository<UserRole>,
    @InjectRepository(ClientLink, 'workspace')
    private readonly links: Repository<ClientLink>,
    @InjectDataSource('source')
    private readonly source: DataSource,
    private readonly cognito: CognitoService,
  ) {}

  async register(dto: ClientRegisterDto) {
    if (!this.cognito.isConfigured()) {
      throw new BadRequestException(
        'Client signup requires Cognito. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const cnic = dto.cnic.trim();
    const phone = dto.phone.trim();

    const erp = await this.matchErpClient(cnic, phone);
    if (!erp) {
      throw new NotFoundException(
        'No ERP client matched this CNIC/phone. Contact Giga Group to register your booking first.',
      );
    }

    const existingUser = await this.users.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const existingLink = await this.links.findOne({
      where: { sourceClientId: erp.id },
      relations: ['user'],
    });
    if (existingLink?.user) {
      throw new ConflictException(
        'This ERP client already has a workspace account',
      );
    }

    const passwordHash = await hashPassword(dto.password);
    const expiresAt = new Date(
      Date.now() + PENDING_TTL_HOURS * 60 * 60 * 1000,
    );
    const clientName = erp.person?.trim() || email;

    const existingPending = await this.pending.findOne({ where: { email } });
    if (existingPending) {
      existingPending.phone = phone;
      existingPending.cnic = cnic;
      existingPending.sourceClientId = erp.id;
      existingPending.clientName = clientName;
      existingPending.passwordHash = passwordHash;
      existingPending.expiresAt = expiresAt;
      await this.pending.save(existingPending);
    } else {
      await this.pending.save(
        this.pending.create({
          email,
          phone,
          cnic,
          sourceClientId: erp.id,
          clientName,
          passwordHash,
          expiresAt,
        }),
      );
    }

    try {
      await this.cognito.signUp({
        email,
        password: dto.password,
        name: erp.person?.trim() || email,
        phone,
      });
    } catch (err) {
      if (
        err instanceof BadRequestException &&
        String(err.message).includes('already exists')
      ) {
        // Unconfirmed Cognito user from a prior attempt — resend the code.
        await this.cognito.resendConfirmationCode(email);
      } else {
        throw err;
      }
    }

    return {
      ok: true,
      email,
      sourceClientId: erp.id,
      clientName: erp.person,
      message:
        'Verification code sent to your email. Confirm with POST /auth/client/confirm.',
    };
  }

  async confirm(dto: ClientConfirmDto) {
    if (!this.cognito.isConfigured()) {
      throw new BadRequestException(
        'Client signup requires Cognito. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.',
      );
    }

    const email = dto.email.trim().toLowerCase();
    const pending = await this.pending.findOne({ where: { email } });
    if (!pending) {
      throw new NotFoundException(
        'No pending signup for this email. Register first.',
      );
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      await this.pending.delete({ id: pending.id });
      throw new BadRequestException(
        'Signup expired. Register again to receive a new code.',
      );
    }

    const existingUser = await this.users.findOne({ where: { email } });
    if (existingUser) {
      await this.pending.delete({ id: pending.id });
      throw new ConflictException('Email is already registered');
    }

    await this.cognito.confirmSignUp(email, dto.code.trim());
    const cognitoSub = await this.cognito.getUserSub(email);

    const role = await this.roles.findOne({ where: { code: 'client' } });
    if (!role) {
      throw new NotFoundException('Client role not found');
    }

    const user = await this.users.save(
      this.users.create({
        name: pending.clientName,
        email,
        phone: pending.phone,
        password: pending.passwordHash,
        cognitoSub,
        mustChangePassword: false,
        status: 'active',
      }),
    );

    await this.userRoles.save(this.userRoles.create({ user, role }));

    let link = await this.links.findOne({
      where: { sourceClientId: pending.sourceClientId },
    });
    if (link) {
      link.user = user;
      link.verificationStatus = 'pending';
      await this.links.save(link);
    } else {
      link = await this.links.save(
        this.links.create({
          user,
          sourceClientId: pending.sourceClientId,
          verificationStatus: 'pending',
        }),
      );
    }

    await this.pending.delete({ id: pending.id });

    return {
      ok: true,
      email,
      userId: String(user.id),
      sourceClientId: pending.sourceClientId,
      verificationStatus: 'pending',
      message:
        'Email confirmed. Your account is pending staff verification. You can sign in; staff will approve access.',
    };
  }

  async resendCode(emailRaw: string) {
    if (!this.cognito.isConfigured()) {
      throw new BadRequestException(
        'Client signup requires Cognito. Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID.',
      );
    }

    const email = emailRaw.trim().toLowerCase();
    const pending = await this.pending.findOne({ where: { email } });
    if (!pending) {
      // Avoid email enumeration
      return {
        ok: true,
        message: 'If a pending signup exists, a new code has been sent',
      };
    }
    if (pending.expiresAt.getTime() < Date.now()) {
      await this.pending.delete({ id: pending.id });
      throw new BadRequestException(
        'Signup expired. Register again to receive a new code.',
      );
    }

    await this.cognito.resendConfirmationCode(email);
    return {
      ok: true,
      message: 'If a pending signup exists, a new code has been sent',
    };
  }

  /**
   * Match ERP client by CNIC (primary). Phone digits are a soft check when ERP
   * has a mobile; empty ERP mobiles still match on CNIC alone.
   */
  async matchErpClient(
    cnic: string,
    phone: string,
  ): Promise<SrcClientMatch | null> {
    const rows = await this.source.query(
      `SELECT id, person, email, mobile_number, cnic
       FROM src_clients
       WHERE cnic = ?
       LIMIT 5`,
      [cnic],
    );

    if (!Array.isArray(rows) || rows.length === 0) {
      return this.matchByPhoneOnly(phone);
    }

    const phoneDigits = this.digits(phone);
    const withPhone = rows.filter((r: SrcClientMatch) => {
      const erpDigits = this.digits(r.mobile_number ?? '');
      if (!erpDigits) return true;
      return this.phonesCompatible(phoneDigits, erpDigits);
    });

    const candidates = withPhone.length > 0 ? withPhone : rows;
    if (candidates.length !== 1) {
      // Multiple CNIC rows (rare) — require unique phone match
      const uniquePhone = rows.filter((r: SrcClientMatch) =>
        this.phonesCompatible(phoneDigits, this.digits(r.mobile_number ?? '')),
      );
      if (uniquePhone.length === 1) {
        return uniquePhone[0];
      }
      return null;
    }

    return candidates[0];
  }

  private async matchByPhoneOnly(
    phone: string,
  ): Promise<SrcClientMatch | null> {
    const phoneDigits = this.digits(phone);
    if (phoneDigits.length < 10) {
      return null;
    }
    const last10 = phoneDigits.slice(-10);
    const rows = await this.source.query(
      `SELECT id, person, email, mobile_number, cnic
       FROM src_clients
       WHERE REPLACE(REPLACE(REPLACE(IFNULL(mobile_number,''), ' ', ''), '-', ''), '+', '')
             LIKE ?
       LIMIT 5`,
      [`%${last10}`],
    );
    if (!Array.isArray(rows) || rows.length !== 1) {
      return null;
    }
    return rows[0];
  }

  private digits(value: string): string {
    return value.replace(/\D/g, '');
  }

  private phonesCompatible(a: string, b: string): boolean {
    if (!a || !b) return false;
    const a10 = a.slice(-10);
    const b10 = b.slice(-10);
    return a10.length >= 10 && a10 === b10;
  }
}
