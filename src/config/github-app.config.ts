import { registerAs } from '@nestjs/config';

/**
 * GitHub App Configuration
 * 
 * These are the app-level credentials (not user OAuth)
 * Used for:
 * 1. Generating App JWTs
 * 2. Exchanging for installation tokens
 * 3. Verifying webhook signatures
 */
export const githubAppConfig = registerAs('githubApp', () => {
  const appId = process.env.GITHUB_APP_ID;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  const slug = process.env.GITHUB_APP_SLUG || 'webruit';

  if (!appId) {
    throw new Error('GITHUB_APP_ID environment variable is required');
  }

  if (!privateKey) {
    throw new Error('GITHUB_APP_PRIVATE_KEY environment variable is required');
  }

  if (!webhookSecret) {
    throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
  }

  return {
    appId,
    privateKey,
    webhookSecret,
    slug,
  };
});