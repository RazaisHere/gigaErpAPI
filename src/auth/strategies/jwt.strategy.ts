import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { UsersService } from '../../users/users.service';
import { JwtPayload, RequestUser } from '../types/jwt-payload';

const ACTIVE_STATUSES = new Set(['active', 'pending_first_login']);

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly users: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('jwt.secret'),
    });
  }

  async validate(payload: JwtPayload): Promise<RequestUser> {
    const user = await this.users.findByIdForAuth(payload.sub);
    if (!user || !ACTIVE_STATUSES.has(user.status)) {
      throw new UnauthorizedException('User is disabled or not found');
    }
    return this.users.toAuthProfile(user);
  }
}
