import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectKeysService } from '../project-keys.service';
import { Request } from 'express';

/**
 * Project Key Guard
 * 
 * Validates project API keys from request headers
 * 
 * Usage:
 * ```typescript
 * @UseGuards(ProjectKeyGuard)
 * @Controller('v1/track')
 * export class TrackingController {
 *   @Post()
 *   async track(@ProjectId() projectId: string) {
 *     // projectId is automatically extracted and validated
 *   }
 * }
 * ```
 * 
 * How it works:
 * 1. Extracts `x-project-key` header
 * 2. Validates key exists and is active
 * 3. Resolves projectId and attaches to request
 * 4. Throws 401 if invalid
 */
@Injectable()
export class ProjectKeyGuard implements CanActivate {
  constructor(private readonly projectKeys: ProjectKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Extract project key from header
    const projectKey = request.headers['x-project-key'] as string | undefined;

    if (!projectKey) {
      throw new UnauthorizedException('Missing project key in x-project-key header');
    }

    if (typeof projectKey !== 'string' || projectKey.trim().length === 0) {
      throw new UnauthorizedException('Invalid project key format');
    }

    // Validate key and resolve projectId
    const projectId = await this.projectKeys.resolveProjectId(projectKey);

    if (!projectId) {
      throw new UnauthorizedException('Invalid or revoked project key');
    }

    // Attach projectId to request for controller access
    (request as any).projectId = projectId;

    return true;
  }
}