import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { jwtConfig } from 'src/config/jwt.config';
import { RefreshUser } from '../domain/refresh-user.model';

export interface JwtRefreshPayload {
  sub: string;
  tokenVersion: number;
}

const refresTokenExtractor = (req: Request): string | null => {
  if (!req || !req.cookies) return null;

  return req.cookies['refresh_token'] ?? null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtCgf: ConfigType<typeof jwtConfig>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([refresTokenExtractor]),
      secretOrKey: jwtCgf.refreshTokenSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtRefreshPayload): Promise<RefreshUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid refresh token payload');
    }
    return {
      userId: payload.sub,
      tokenVersion: payload.tokenVersion,
    };
  }
}
