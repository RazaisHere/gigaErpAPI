import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CognitoModule } from '../cognito/cognito.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './guards/must-change-password.guard';
import { RolesGuard } from './guards/roles.guard';
import { CognitoJwtStrategy } from './strategies/cognito-jwt.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';

const authProvider = process.env.AUTH_PROVIDER ?? 'nest';

@Module({
  imports: [
    UsersModule,
    CognitoModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('jwt.secret'),
        signOptions: {
          // seconds — avoids jsonwebtoken StringValue brand mismatch from env strings
          expiresIn: 60 * 60 * 8,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    ...(authProvider === 'cognito'
      ? [CognitoJwtStrategy]
      : [JwtStrategy]),
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
