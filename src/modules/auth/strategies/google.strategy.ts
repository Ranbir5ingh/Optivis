import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { googleConfig } from 'src/config/google.config';
import { GoogleProfileData } from '../domain/google-profile-data.model';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(googleConfig.KEY)
    private readonly googleCgf: ConfigType<typeof googleConfig>,
  ) {
    super({
      clientID: googleCgf.clientId,
      clientSecret: googleCgf.clientSecret,
      callbackURL: googleCgf.callbackUrl,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<GoogleProfileData> {
    const email = profile.emails?.[0]?.value ?? null;
    const name = profile.displayName ?? '';
    const googleId = profile.id;

    if (!email) {
      throw new UnauthorizedException(
        'Google account does not provide an email.',
      );
    }

    return {
      googleId,
      email,
      name,
    };
  }
}
