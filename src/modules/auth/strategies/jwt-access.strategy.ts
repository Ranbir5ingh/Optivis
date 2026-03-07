import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from 'src/config/jwt.config';
import { UsersService } from 'src/modules/users/users.service';
import { AuthUser } from '../domain/auth-user.model';
import { UserRole } from 'src/modules/users/domain/user-role.enum';

export interface JwtAccessPayload {
  sub: string; // userId
  name: string;
  email: string;
  role: string;
  tokenVersion: number;
}

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(
  Strategy,
  'jwt-access',
) {
  constructor(
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtCfg.accessTokenSecret,
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthUser> {
    const user = await this.usersService.findByEmail(payload.email);
    if (!user) {
      throw new UnauthorizedException('User not found or token invalid.');
    }
    return {
      userId: payload.sub,
      name: payload.name,
      email: payload.email,
      role: payload.role as UserRole,
      tokenVersion: payload.tokenVersion,
    };
  }
}
