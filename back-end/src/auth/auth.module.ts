import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './google.strategy';
import { OAuthController } from './oauth.controller';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [AuthResolver, AuthService, GoogleStrategy],
  controllers: [OAuthController],
})
export class AuthModule {}
