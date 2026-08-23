import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MockAuthGuard } from './mock-auth.guard';
import { RolesGuard } from './roles.guard';
import { AccessControlService } from './access-control.service';
import { AuthController } from './auth.controller';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AccessControlService,
    MockAuthGuard,
    RolesGuard,
    { provide: APP_GUARD, useClass: MockAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AccessControlService],
})
export class AuthModule {}
