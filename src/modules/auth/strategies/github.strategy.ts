import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { githubConfig } from 'src/config/github.config';
import type { GithubProfileData } from '../domain/github-profile-data.model';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(
    @Inject(githubConfig.KEY)
    private readonly githubCfg: ConfigType<typeof githubConfig>,
  ) {
    super({
      clientID: githubCfg.clientId,
      clientSecret: githubCfg.clientSecret,
      callbackURL: githubCfg.callbackUrl,
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): Promise<GithubProfileData> {
    const githubId = profile.id;
    const email = profile.emails?.[0]?.value ?? null;
    const name = profile.displayName ?? '';

    if (!email) {
      throw new UnauthorizedException(
        'Github account does not provide an email.',
      );
    }

    return {
      githubId,
      email,
      name,
    };
  }
}
