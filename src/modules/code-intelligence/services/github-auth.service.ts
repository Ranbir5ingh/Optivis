import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { DomainError } from 'src/common/exceptions/domain-error';

/**
 * GitHub App Authentication Service
 *
 * Responsibility: Generate GitHub App JWTs
 * These JWTs are used to:
 * 1. Exchange for installation access tokens
 * 2. Make API calls as the GitHub App itself
 *
 * This is NOT OAuth (user authentication)
 * This is machine-to-machine authentication
 */
@Injectable()
export class GithubAuthService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Generate GitHub App JWT
   *
   * Valid for max 10 minutes
   * Used to exchange for installation tokens
   *
   * @returns JWT string
   */
  generateAppJwt(): string {
    const appId = this.config.get<string>('GITHUB_APP_ID');
    const privateKey = this.config.get<string>('GITHUB_APP_PRIVATE_KEY');

    if (!appId || !privateKey) {
      throw new DomainError(
        'GITHUB_APP_MISCONFIGURED',
        'GitHub App credentials not configured',
        'unexpected',
        { missingFields: { appId: !appId, privateKey: !privateKey } },
      );
    }

    try {
      const decodedKey = privateKey.includes('BEGIN')
        ? privateKey
        : Buffer.from(privateKey, 'base64').toString('utf-8');

      const now = Math.floor(Date.now() / 1000);
      const iat = now - 10; // 10-second backdate
      const exp = iat + 590; // 590 seconds after issue time

      return jwt.sign(
        {
          iat,
          exp,
          iss: appId,
        },
        decodedKey,
        {
          algorithm: 'RS256',
        },
      );
    } catch (error) {
      throw new DomainError(
        'GITHUB_JWT_GENERATION_FAILED',
        `Failed to generate GitHub App JWT: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unexpected',
      );
    }
  }

  /**
   * Exchange App JWT for installation access token
   *
   * @param installationId GitHub App installation ID
   * @returns Access token string
   */
  async getInstallationToken(installationId: string): Promise<string> {
    const appJwt = this.generateAppJwt();

    try {
      const response = await fetch(
        `https://api.github.com/app/installations/${installationId}/access_tokens`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${appJwt}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        },
      );

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `GitHub API error: ${response.status} ${response.statusText} - ${errorData}`,
        );
      }

      const data = (await response.json()) as { token: string };
      return data.token;
    } catch (error) {
      throw new DomainError(
        'GITHUB_TOKEN_EXCHANGE_FAILED',
        `Failed to exchange App JWT for installation token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'unexpected',
      );
    }
  }
}
