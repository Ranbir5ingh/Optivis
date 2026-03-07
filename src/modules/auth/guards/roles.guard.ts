import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from 'src/modules/users/domain/user-role.enum';
import { Request } from 'express';

export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );

    if(!requiredRoles.length) return true
    
    const req = ctx.switchToHttp().getRequest<Request>()
    const user = req.user as {role?: string}

    if(!user?.role) return false

    return requiredRoles.includes(user?.role as UserRole)
  }
}
