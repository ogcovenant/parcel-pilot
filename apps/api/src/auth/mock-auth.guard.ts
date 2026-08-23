import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { MOCK_USERS } from './mock-users';

/**
 * Mock authentication. Reads an X-User-Email header and resolves the user.
 * Replace with a real JWT/SSO flow in production; the contract (user context)
 * stays identical.
 */
@Injectable()
export class MockAuthGuard {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const email = request.headers['x-user-email'] as string | undefined;
    if (!email) throw new UnauthorizedException('Missing X-User-Email header');

    const user = MOCK_USERS[email.toLowerCase()];
    if (!user) throw new UnauthorizedException(`Unknown user: ${email}`);

    request.user = user;
    return true;
  }
}
