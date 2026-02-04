import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'

import type { AuthenticatedUser } from '../../common/types'

export const CurrentUser = createParamDecorator(
  (data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as AuthenticatedUser

    if (data) {
      return user[data]
    }

    return user
  },
)
