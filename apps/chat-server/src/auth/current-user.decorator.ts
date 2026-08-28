import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { UsersCache } from '@prisma/client';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsersCache => {
    const request = ctx.switchToHttp().getRequest<{ user: UsersCache }>();
    return request.user;
  },
);
