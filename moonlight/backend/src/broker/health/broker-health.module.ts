import { Module, Global } from '@nestjs/common';
import { BrokerHealthRegistryService } from './broker-health-registry.service';
import { BrokerHealthController } from './broker-health.controller';

@Global()
@Module({
  providers: [BrokerHealthRegistryService],
  controllers: [BrokerHealthController],
  exports: [BrokerHealthRegistryService],
})
export class BrokerHealthModule {}
