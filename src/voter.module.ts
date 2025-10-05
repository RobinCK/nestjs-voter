import { Module, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { VoterInterceptor } from './interceptors/voter.interceptor';

@Global()
@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: VoterInterceptor,
    },
  ],
  exports: [],
})
export class VoterModule {}
