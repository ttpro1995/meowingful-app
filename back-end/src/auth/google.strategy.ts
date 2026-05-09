import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { PrismaService } from '../prisma/prisma.service';

export interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  photo?: string;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private prisma: PrismaService) {
    super({
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3500/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<void> {
    const { id, emails, displayName, photos } = profile;

    const email = emails?.[0]?.value;
    const name = displayName;
    const photo = photos?.[0]?.value;

    if (!email) {
      return done(new Error('No email found in Google profile'), false);
    }

    try {
      // Find existing OAuth account
      let oauthAccount = await this.prisma.oAuthAccount.findUnique({
        where: {
          provider_providerId: {
            provider: 'google',
            providerId: id,
          },
        },
        include: { user: true },
      });

      if (oauthAccount) {
        // Existing OAuth user - return the user
        return done(null, {
          userId: oauthAccount.userId,
          email: oauthAccount.email || email,
          name: oauthAccount.user.name,
          provider: 'google',
          providerId: id,
        });
      }

      // Check if user with this email already exists
      const existingUser = await this.prisma.user.findFirst({
        where: { auth: { username: email } },
        include: { auth: true },
      });

      let user;
      if (existingUser) {
        // User exists with this email (password user) - link accounts
        user = existingUser;
      } else {
        // Create new user without password
        user = await this.prisma.user.create({
          data: {
            username: email,
            name,
          },
        });
      }

      // Create OAuth account
      oauthAccount = await this.prisma.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: 'google',
          providerId: id,
          email,
        },
        include: { user: true },
      });

      return done(null, {
        userId: oauthAccount.userId,
        email,
        name,
        provider: 'google',
        providerId: id,
      });
    } catch (error) {
      return done(error, false);
    }
  }
}