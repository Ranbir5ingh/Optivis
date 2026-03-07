import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

/**
 * Project ID Decorator
 * 
 * Extracts projectId from request (set by ProjectKeyGuard)
 * 
 * Usage:
 * ```typescript
 * @UseGuards(ProjectKeyGuard)
 * @Post('track')
 * async track(@ProjectId() projectId: string) {
 *   console.log(projectId); // 'proj_123'
 * }
 * ```
 * 
 * IMPORTANT: Must be used with ProjectKeyGuard
 */
export const ProjectId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const projectId = (request as any).projectId;

    if (!projectId) {
      throw new Error(
        'ProjectId decorator used without ProjectKeyGuard. ' +
        'Add @UseGuards(ProjectKeyGuard) to your controller or route.'
      );
    }

    return projectId;
  },
);