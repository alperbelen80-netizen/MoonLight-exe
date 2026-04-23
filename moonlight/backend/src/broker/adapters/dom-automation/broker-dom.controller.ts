import { Controller, Get, Post, Body } from '@nestjs/common';
import {
  DomBrowserSessionManager,
  SelectorRegistry,
} from './dom-base';
import {
  OlympTradeDomAdapter,
  BinomoDomAdapter,
  ExpertOptionDomAdapter,
} from './dom-broker.adapters';
import { BrokerId } from '../../health/broker-health-registry.service';

interface DomBrokerStatus {
  brokerId: BrokerId;
  sessionHealth: string;
  selectorVersion: string | null;
  lastLatencyMs: number | null;
}

/**
 * V2.5-4 DOM automation control surface.
 *
 *  - GET  /api/broker/dom/status   → 3 broker + global automation flag
 *  - POST /api/broker/dom/connect  → connectSession for a broker (dry-run)
 *  - POST /api/broker/dom/disconnect
 *
 * Live order placement is gated by BROKER_DOM_LIVE_ORDERS=true (see
 * `DomBrokerAdapterBase.sendOrder()`); this controller never commits live
 * trades itself — it's strictly for session lifecycle + health visibility.
 */
@Controller('broker/dom')
export class BrokerDomController {
  constructor(
    private readonly sessions: DomBrowserSessionManager,
    private readonly selectors: SelectorRegistry,
    private readonly olymp: OlympTradeDomAdapter,
    private readonly binomo: BinomoDomAdapter,
    private readonly expert: ExpertOptionDomAdapter,
  ) {}

  private pick(brokerId: BrokerId) {
    switch (brokerId) {
      case 'OLYMP_TRADE':
        return this.olymp;
      case 'BINOMO':
        return this.binomo;
      case 'EXPERT_OPTION':
        return this.expert;
      default:
        return null;
    }
  }

  @Get('status')
  status(): {
    automationEnabled: boolean;
    liveOrdersEnabled: boolean;
    activeSessions: ReturnType<DomBrowserSessionManager['listActive']>;
    brokers: DomBrokerStatus[];
  } {
    const brokers: DomBrokerStatus[] = (
      ['OLYMP_TRADE', 'BINOMO', 'EXPERT_OPTION'] as BrokerId[]
    ).map((id) => {
      const adapter = this.pick(id)!;
      const bundle = this.selectors.get(id);
      return {
        brokerId: id,
        sessionHealth: adapter.getSessionHealth(),
        selectorVersion: bundle?.version ?? null,
        lastLatencyMs: adapter.getLastLatencyMs() ?? null,
      };
    });
    return {
      automationEnabled: this.sessions.isEnabled(),
      liveOrdersEnabled: process.env.BROKER_DOM_LIVE_ORDERS === 'true',
      activeSessions: this.sessions.listActive(),
      brokers,
    };
  }

  @Post('connect')
  async connect(
    @Body() body: { brokerId: BrokerId; accountId?: string },
  ): Promise<{ ok: boolean; brokerId: BrokerId; error?: string }> {
    const adapter = this.pick(body?.brokerId);
    if (!adapter) {
      return { ok: false, brokerId: body?.brokerId, error: 'unknown brokerId' };
    }
    try {
      await adapter.connectSession(body.accountId ?? 'ACC_DOM');
      return { ok: true, brokerId: body.brokerId };
    } catch (err) {
      return {
        ok: false,
        brokerId: body.brokerId,
        error: (err as Error).message,
      };
    }
  }

  @Post('disconnect')
  async disconnect(
    @Body() body: { brokerId: BrokerId; accountId?: string },
  ): Promise<{ ok: boolean; brokerId: BrokerId }> {
    const adapter = this.pick(body?.brokerId);
    if (!adapter) return { ok: false, brokerId: body?.brokerId };
    await adapter.disconnectSession(body.accountId ?? 'ACC_DOM');
    return { ok: true, brokerId: body.brokerId };
  }
}
