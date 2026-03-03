import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/roles.decorator';
import { UserRole } from '../users/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext) {
        const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!required || required.length === 0) return true;
        const req = context.switchToHttp().getRequest();
        const user = req.user;
        if (!user?.role) throw new ForbiddenException('Forbidden');
        if (!required.includes(user.role)) throw new ForbiddenException('Forbidden');
        return true;
    }
}
