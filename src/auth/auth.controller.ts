import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { SkipMustChangePassword } from './decorators/skip-must-change-password.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RequestUser } from './types/jwt-payload';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign in with email and password' })
  @ApiOkResponse({ description: 'JWT access token and user profile' })
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password);
  }

  @SkipMustChangePassword()
  @Post('logout')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Sign out (client discards the bearer token; JWT is stateless)',
  })
  logout() {
    return { ok: true };
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
    summary: 'Change password (required when mustChangePassword is true)',
  })
  changePassword(
    @CurrentUser() user: RequestUser,
    @Body() body: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      user.id,
      body.currentPassword,
      body.newPassword,
    );
  }
}
