import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from './mock-users';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): User => {
    return context.switchToHttp().getRequest().user;
  },
);

export type { User };
export type { Role } from './mock-users';
export { ROLES, MOCK_USERS, findMockUser } from './mock-users';
