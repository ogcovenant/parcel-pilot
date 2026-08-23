import { Controller, Get, Headers } from '@nestjs/common';
import { MOCK_USERS } from './mock-users';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@Headers('x-user-email') email?: string) {
    if (!email) return { authenticated: false };
    const user = MOCK_USERS[email.toLowerCase()];
    if (!user) return { authenticated: false };
    return { authenticated: true, user };
  }

  @Get('users')
  listUsers() {
    return Object.values(MOCK_USERS).map(
      ({ id, email, name, role, accountId }) => ({
        id,
        email,
        name,
        role,
        accountId,
      }),
    );
  }
}
