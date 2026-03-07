import { Inject, Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import type { ConfigType } from '@nestjs/config';
import { jwtConfig } from 'src/config/jwt.config';
import { UserModel } from '../users/domain/user.model';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto';
import * as argon2 from 'argon2';
import { DomainError } from 'src/common/exceptions/domain-error';
import { LoginDto } from './dto/login.dto';
import type { GoogleProfileData } from './domain/google-profile-data.model';
import type{ GithubProfileData } from './domain/github-profile-data.model';
import { AuthUser } from './domain/auth-user.model';

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    @Inject(jwtConfig.KEY)
    private readonly jwtCfg: ConfigType<typeof jwtConfig>,
  ) {}

  private async signToken(
    user: UserModel & { tokenVersion: number },
  ): Promise<Tokens> {
    const payloadBase = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = await this.jwtService.signAsync(payloadBase, {
      secret: this.jwtCfg.accessTokenSecret,
      expiresIn: this.jwtCfg.accessTokenTtl,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, tokenVersion: user.tokenVersion },
      {
        secret: this.jwtCfg.refreshTokenSecret,
        expiresIn: this.jwtCfg.refreshTokenTtl,
      },
    );

    return { accessToken, refreshToken };
  }

  async register(dto: RegisterDto): Promise<Tokens> {
    const passwordHash = await argon2.hash(dto.password);
    const user = await this.usersService.createLocalUser({
      name: dto.name,
      email: dto.email,
      passwordHash,
    });

    return await this.signToken({ ...user, tokenVersion: 0 });
  }

  async validateUser(
    email: string,
    password: string,
  ): Promise<UserModel & { tokenVersion: number }> {
    const { user, tokenVersion, passwordHash } =
      await this.usersService.findAuthDataByEmail(email);

    if (!passwordHash) {
      throw new DomainError(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        'unauthorized',
        { email },
      );
    }

    const passwordValid = await argon2.verify(passwordHash, password);

    if (!passwordValid) {
      throw new DomainError(
        'INVALID_CREDENTIALS',
        'Invalid email or password',
        'unauthorized',
        { email },
      );
    }

    return { ...user, tokenVersion };
  }

  async login(dto: LoginDto): Promise<Tokens> {
    const user = await this.validateUser(dto.email, dto.password);
    return this.signToken(user);
  }

  async refreshTokens(userId: string, tokenVersion: number): Promise<Tokens> {
    const { user, tokenVersion: storedTokenVersion } =
      await this.usersService.findAuthDataById(userId);

    if (storedTokenVersion !== tokenVersion) {
      throw new DomainError(
        'REFRESH_TOKEN_REVOKED',
        'Refresh token has been revoked',
        'unauthorized',
        { userId },
      );
    }
    return this.signToken({ ...user, tokenVersion: storedTokenVersion });
  }

  async googleLogin(googleUser: GoogleProfileData): Promise<Tokens> {
    const user = await this.usersService.findOrCreateFromGoogle(googleUser);
    const { tokenVersion } = await this.usersService.findAuthDataById(user.id);

    return this.signToken({ ...user, tokenVersion });
  }

  async githubLogin(githubUser: GithubProfileData): Promise<Tokens> {
    const user = await this.usersService.findOrCreateFromGithub(githubUser);
    const { tokenVersion } = await this.usersService.findAuthDataById(user.id);

    return this.signToken({ ...user, tokenVersion });
  }

  async logout(userId: string): Promise<void>{
    await this.usersService.bumpTokenVersion(userId)
  }
}
