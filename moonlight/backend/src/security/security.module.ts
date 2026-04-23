import { Module } from '@nestjs/common';
import { SecretsStoreService } from './secrets-store.service';
import { SecretsController } from './secrets.controller';

/**
 * V2.6-2 Security module: secrets vault + (future v2.6.x) encryption
 * utilities. Exported so any module that needs secret reads (broker
 * credentials, webhook HMAC keys, AI provider keys) can inject
 * `SecretsStoreService` directly.
 */
@Module({
  controllers: [SecretsController],
  providers: [SecretsStoreService],
  exports: [SecretsStoreService],
})
export class SecurityModule {}
