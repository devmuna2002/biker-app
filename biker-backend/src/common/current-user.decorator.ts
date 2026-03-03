import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type AuthenticatedUser = {
    id: number;
    role: string;
    sessionId: string;
};

export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
        const req = ctx.switchToHttp().getRequest();
        return req.user;
    },
);
