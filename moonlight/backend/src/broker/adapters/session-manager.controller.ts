import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { BrokerAdapterRegistry, SupportedBrokerId } from './broker-adapter.registry';
import { BrokerCredentialsService } from './broker-credentials.service';

interface ConnectRequest {
  accountId: string;
}

/**
 * Session Manager REST API
 *
 * Lets the desktop UI open/close per-broker sessions, see credential state,
 * and list live adapter health. Paired with the frontend SessionManager page.
 */
@Controller('broker/session')
export class SessionManagerController {
  constructor(
    private readonly registry: BrokerAdapterRegistry,
    private readonly creds: BrokerCredentialsService,
  ) {}

  @Get('status')
  getStatus() {
    return {
      adapters: this.registry.getHealthSnapshot(),
      credentials: this.creds.summary(),
      mock_mode: this.creds.isMockMode(),
      generated_at_utc: new Date().toISOString(),
    };
  }

  @Post(':brokerId/connect')
  async connect(
    @Param('brokerId') brokerId: string,
    @Body() body: ConnectRequest,
  ) {
    const adapter = this.resolve(brokerId);
    try {
      await adapter.connectSession(body.accountId || 'default');
      return {
        ok: true,
        brokerId: adapter.getBrokerId(),
        health: adapter.getSessionHealth(),
      };
    } catch (err: any) {
      // Surface the specific reason (e.g. CREDENTIALS_MISSING) to the UI.
      throw new HttpException(
        {
          ok: false,
          brokerId: adapter.getBrokerId(),
          health: adapter.getSessionHealth(),
          error: err?.message || 'Connect failed',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Post(':brokerId/disconnect')
  async disconnect(
    @Param('brokerId') brokerId: string,
    @Body() body: ConnectRequest,
  ) {
    const adapter = this.resolve(brokerId);
    await adapter.disconnectSession(body.accountId || 'default');
    return {
      ok: true,
      brokerId: adapter.getBrokerId(),
      health: adapter.getSessionHealth(),
    };
  }

  private resolve(brokerId: string) {
    try {
      return this.registry.get(brokerId as SupportedBrokerId);
    } catch {
      throw new HttpException(
        { error: `Unknown broker id: ${brokerId}` },
        HttpStatus.NOT_FOUND,
      );
    }
  }
}
