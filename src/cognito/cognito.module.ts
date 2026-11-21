import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CognitoService } from './cognito.service';
import { UserIdentityService } from './user-identity.service';

@Module({
  imports: [UsersModule],
  providers: [CognitoService, UserIdentityService],
  exports: [CognitoService, UserIdentityService],
})
export class CognitoModule {}
