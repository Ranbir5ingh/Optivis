// src/modules/code-intelligence/controllers/github-webhook.controller.ts

import {
  Body,
  Controller,
  Post,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { OrgGithubInstallationsService } from '../services/org-github-installations.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface GitHubPullRequest {
  number: number;
  merged: boolean;
  merge_commit_sha: string;
}

interface GitHubWebhookPayload {
  action: string;
  pull_request?: GitHubPullRequest;
}

@Controller('github/webhooks')
export class GithubWebhookController {
  private readonly logger = new Logger(GithubWebhookController.name);

  constructor(
    private readonly orgInstallationsService: OrgGithubInstallationsService,
    private readonly config: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private verifySignature(signature: string, payload: Buffer): boolean {
    const secret = this.config.get<string>('GITHUB_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('GitHub webhook secret not configured');
      return false;
    }

    const hash = createHmac('sha256', secret).update(payload).digest('hex');
    const expected = `sha256=${hash}`;
    return signature === expected;
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  async handleWebhook(
    @Body() payload: GitHubWebhookPayload,
    @Headers('x-hub-signature-256') signature: string,
    @Headers('x-github-event') event: string,
  ): Promise<void> {
    const payloadBuffer = Buffer.from(JSON.stringify(payload));
    if (!this.verifySignature(signature, payloadBuffer)) {
      this.logger.warn('Invalid GitHub webhook signature');
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log(`GitHub webhook received: ${event}`);

    switch (event) {
      case 'installation':
        await this.handleInstallationEvent(payload);
        break;

      case 'installation_repositories':
        await this.handleRepositoriesEvent(payload);
        break;

      case 'pull_request':
        await this.handlePullRequestEvent(payload);
        break;

      default:
        this.logger.log(`Ignoring event type: ${event}`);
    }
  }

  private async handlePullRequestEvent(
    payload: GitHubWebhookPayload,
  ): Promise<void> {
    if (!payload.pull_request) {
      return;
    }

    const action = payload.action as string;

    if (action === 'closed' && payload.pull_request.merged) {
      const prNumber = payload.pull_request.number;
      const mergeCommitSha = payload.pull_request.merge_commit_sha;

      this.logger.log(`PR merged: ${prNumber} (commit: ${mergeCommitSha})`);

      this.eventEmitter.emit('github.pr_merged', {
        prNumber: String(prNumber),
        mergeCommitSha,
      });
    }
  }

  private async handleInstallationEvent(
    payload: GitHubWebhookPayload,
  ): Promise<void> {
    const action = payload.action as string;

    switch (action) {
      case 'created':
        this.logger.log('GitHub App installed');
        break;

      case 'deleted':
        this.logger.log('GitHub App uninstalled');
        break;

      default:
        break;
    }
  }

  private async handleRepositoriesEvent(
    payload: GitHubWebhookPayload,
  ): Promise<void> {
    const action = payload.action as string;

    switch (action) {
      case 'added':
        this.logger.log('Repositories added to installation');
        break;

      case 'removed':
        this.logger.log('Repositories removed from installation');
        break;

      default:
        break;
    }
  }
}
