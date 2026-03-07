import { registerAs } from '@nestjs/config';
import type { JwtSignOptions } from '@nestjs/jwt';

type ExpiresIn = JwtSignOptions['expiresIn']

export const jwtConfig = registerAs('jwt', () => {
  const access = process.env.JWT_ACCESS_TOKEN_SECRET;
  const refresh = process.env.JWT_REFRESH_TOKEN_SECRET;

  if (!access || !refresh) {
    throw new Error('JWT secrets must be defined');
  }

  if (access.length < 32 || refresh.length < 32) {
    throw new Error('JWT secrets must be at least 32 characters');
  }

  return {
    accessTokenSecret: access,
    refreshTokenSecret: refresh,
    accessTokenTtl: '15m' as ExpiresIn,
    refreshTokenTtl: '7d' as ExpiresIn,
  };
});
