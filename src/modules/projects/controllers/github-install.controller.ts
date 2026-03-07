// src/modules/projects/controllers/github-install.controller.ts
import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { ProjectsService } from '../services/projects.service';
import { OrgGithubInstallationsService } from 'src/modules/code-intelligence/services/org-github-installations.service';
import { OrganizationPolicy } from 'src/modules/organizations/policies/organization.policy';

@Controller('github/install')
export class GithubInstallController {
  private readonly logger = new Logger(GithubInstallController.name);

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly orgInstallationsService: OrgGithubInstallationsService,
    private readonly orgPolicy: OrganizationPolicy,
    private readonly config: ConfigService,
  ) {}

  @Get('callback')
  async handleInstallCallback(
    @Query('installation_id') installationId: string,
    @Query('state') state: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    if (!installationId || !state) {
      throw new BadRequestException('Missing installation_id or state');
    }

    const frontendOrigin = this.config.get<string>('FRONTEND_ORIGIN') ?? '';

    try {
      const context = this.projectsService.verifyGithubState(state);

      await this.orgPolicy.assertMember(context.organizationId, context.userId);

      await this.orgInstallationsService.storeInstallation(
        context.organizationId,
        installationId,
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(
        this.buildSuccessHtml(
          frontendOrigin,
          context.organizationId,
          installationId,
        ),
      );
    } catch (error) {
      this.logger.error(
        `GitHub install callback failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      res.setHeader('Content-Type', 'text/html');
      res.send(
        this.buildErrorHtml(
          frontendOrigin,
          error instanceof Error ? error.message : 'Unknown error',
        ),
      );
    }
  }

  private buildSuccessHtml(
    frontendOrigin: string,
    organizationId: string,
    installationId: string,
  ): string {
    return `<!DOCTYPE html>
<html>
  <head><title>GitHub Installed</title></head>
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'GITHUB_INSTALLATION_SUCCESS',
            organizationId: ${JSON.stringify(organizationId)},
            installationId: ${JSON.stringify(installationId)},
          },
          ${JSON.stringify(frontendOrigin)}
        );
        window.close();
      } else {
        document.body.innerHTML = '<p>GitHub App installed. You can close this window.</p>';
      }
    </script>
    <p>GitHub App installed. Closing...</p>
  </body>
</html>`;
  }

  private buildErrorHtml(frontendOrigin: string, errorMessage: string): string {
    return `<!DOCTYPE html>
<html>
  <head><title>Installation Failed</title></head>
  <body>
    <script>
      if (window.opener) {
        window.opener.postMessage(
          {
            type: 'GITHUB_INSTALLATION_ERROR',
            error: ${JSON.stringify(errorMessage)},
          },
          ${JSON.stringify(frontendOrigin)}
        );
        window.close();
      } else {
        document.body.innerHTML = '<p>Failed to install GitHub App. Please try again.</p>';
      }
    </script>
    <p>Installation failed. Closing...</p>
  </body>
</html>`;
  }
}