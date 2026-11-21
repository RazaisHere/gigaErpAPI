import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { SkipMustChangePassword } from './decorators/skip-must-change-password.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { CompleteNewPasswordDto } from './dto/complete-new-password.dto';
import { ConfirmForgotPasswordDto } from './dto/confirm-forgot-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestUser } from './types/jwt-payload';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Sign in (Nest JWT when AUTH_PROVIDER=nest; Cognito tokens when cognito)',
  })
  @ApiOkResponse({ description: 'Access token (and optional Cognito challenge)' })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @Public()
  @Post('complete-new-password')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Complete Cognito NEW_PASSWORD_REQUIRED challenge (AUTH_PROVIDER=cognito)',
  })
  completeNewPassword(@Body() body: CompleteNewPasswordDto) {
    return this.auth.completeNewPassword(
      body.email,
      body.newPassword,
      body.session,
    );
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Refresh Cognito tokens (AUTH_PROVIDER=cognito)' })
  refresh(@Body() body: RefreshTokenDto) {
    return this.auth.refresh(body.email, body.refreshToken);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start Cognito forgot-password (AUTH_PROVIDER=cognito)' })
  forgotPassword(@Body() body: ForgotPasswordDto) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Post('confirm-forgot-password')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Confirm Cognito forgot-password with code (AUTH_PROVIDER=cognito)',
  })
  confirmForgotPassword(@Body() body: ConfirmForgotPasswordDto) {
    return this.auth.confirmForgotPassword(
      body.email,
      body.code,
      body.newPassword,
    );
  }

  @SkipMustChangePassword()
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Sign out (Cognito GlobalSignOut when AUTH_PROVIDER=cognito; else client discard)',
  })
  logout(
    @Headers('authorization') authorization?: string,
    @Req() req?: Request,
  ) {
    const header =
      authorization ??
      (req?.headers?.authorization as string | undefined) ??
      '';
    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length)
      : undefined;
    return this.auth.logout(token);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current authenticated user' })
  me(@CurrentUser() user: RequestUser) {
    return this.auth.me(user);
  }

  @SkipMustChangePassword()
  @Post('change-password')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change password (Nest local hash or Cognito ChangePassword)',
  })
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: ChangePasswordDto,
    @Headers('authorization') authorization?: string,
  ) {
    const token = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : undefined;
    return this.auth.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
      token,
    );
  }
}
