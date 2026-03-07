import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  Req,
  Res,
  Header,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { ApiSuccessResponse } from 'src/shared/types/api-response';
import type { Request, Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from './domain/auth-user.model';
import { ConfigService } from '@nestjs/config';
import type { RefreshUser } from './domain/refresh-user.model';
import type { GoogleProfileData } from './domain/google-profile-data.model';
import type { GithubProfileData } from './domain/github-profile-data.model';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private sendOAuthPopupResponse(res: Response, accessToken: string): void {
    res.setHeader('Content-Type', 'text/html');

    const payload = {
      type: 'oauth-success',
      accessToken,
    };

    res.send(`
    <html>
      <body>
        <script>
          (function () {
            const payload = ${JSON.stringify(payload)};
            const origin = ${JSON.stringify(
              this.configService.get<string>('FRONTEND_ORIGIN'),
            )};

            if (window.opener) {
              window.opener.postMessage(payload, origin);
              window.close();
            }
          })();
        </script>
      </body>
    </html>
  `);
  }

  private isProduction(): boolean {
    return this.configService.get<string>('NODE_ENV') === 'production';
  }

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: this.isProduction(), // false in dev, true in prod
      sameSite: 'lax', // ✅ REQUIRED
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ accessToken: string }>> {
    const { accessToken, refreshToken } = await this.authService.register(dto);
    this.setRefreshTokenCookie(res, refreshToken);
    return {
      status: 'success',
      data: { accessToken },
    };
  }
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ accessToken: string }>> {
    const { accessToken, refreshToken } = await this.authService.login(dto);
    this.setRefreshTokenCookie(res, refreshToken);
    return {
      status: 'success',
      data: { accessToken },
    };
  }

  @Post('refresh')
  @UseGuards(JwtRefreshGuard)
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request & { user: RefreshUser },
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<{ accessToken: string }>> {
    const { userId, tokenVersion } = req.user;
    const { accessToken, refreshToken } = await this.authService.refreshTokens(
      userId,
      tokenVersion,
    );

    this.setRefreshTokenCookie(res, refreshToken);

    return {
      status: 'success',
      data: { accessToken },
    };
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  async me(
    @CurrentUser() user: AuthUser,
  ): Promise<ApiSuccessResponse<AuthUser>> {
    console.log('✅ /me response:', user);
    return {
      status: 'success',
      data: user,
    };
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleAuth(): void {}

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallBack(
    @Req()
    req: Request & {
      user: GoogleProfileData;
    },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.authService.googleLogin(
      req.user,
    );
    this.setRefreshTokenCookie(res, refreshToken);
    this.sendOAuthPopupResponse(res, accessToken);
  }

  @Get('github')
  @UseGuards(AuthGuard('github'))
  githubAuth(): void {}

  @Get('github/callback')
  @UseGuards(AuthGuard('github'))
  async githubCallBack(
    @Req()
    req: Request & {
      user: GithubProfileData;
    },
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.authService.githubLogin(
      req.user,
    );
    this.setRefreshTokenCookie(res, refreshToken);
    this.sendOAuthPopupResponse(res, accessToken);
  }

  @Post('logout')
  @UseGuards(JwtAccessGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.logout(user.userId);

    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: this.isProduction(),
      sameSite: 'lax',
      path: '/',
    });

    return {
      status: 'success',
      data: null,
    };
  }
}
