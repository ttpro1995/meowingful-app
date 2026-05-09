import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('auth')
export class OAuthController {
  constructor(private authService: AuthService) {}

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    // The user profile is attached by Passport after successful validation
    const userProfile = (req as any).user;

    if (!userProfile) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:8500'}?error=auth_failed`);
    }

    // Generate token pair
    const { accessToken, refreshToken } = await this.authService.generateTokenPair(userProfile.userId);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    // Redirect to frontend with access token in query param
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8500';
    return res.redirect(`${frontendUrl}?accessToken=${accessToken}&provider=google`);
  }
}