import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentPortalUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const portalUser = request.portalUser;
    return data ? portalUser?.[data] : portalUser;
  },
);
