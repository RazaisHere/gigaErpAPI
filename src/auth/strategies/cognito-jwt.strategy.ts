import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { passportJwtSecret } from 'jwks-rsa';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { CognitoService } from '../../cognito/cognito.service';
import { UsersService } from '../../users/users.service';
import { RequestUser } from '../types/jwt-payload';

type CognitoAccessTokenPayload = {
  sub: string;
  client_id?: string;
  token_use?: string;
  username?: string;
  iss?: string;
};

const ACTIVE_STATUSES = new Set(['active', 'pending_first_login']);

@Injectable()
export class CognitoJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    cognito: CognitoService,
    private readonly users: UsersService,
  ) {
    const region = config.getOrThrow<string>('cognito.region');
    const userPoolId = config.getOrThrow<string>('cognito.userPoolId');
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: cognito.jwksUri,
      }),
    });
  }

  async validate(payload: CognitoAccessTokenPayload): Promise<RequestUser> {
    if (payload.token_use && payload.token_use !== 'access') {
      throw new UnauthorizedException('Access token required');
    }

    const user = await this.users.findByCognitoSub(payload.sub);
    if (!user || !ACTIVE_STATUSES.has(user.status)) {
      throw new UnauthorizedException('User is disabled or not linked to Cognito');
    }

    return this.users.toAuthProfile(user);
  }
}
