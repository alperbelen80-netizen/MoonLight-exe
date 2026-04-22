import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../../shared/dto/broker-order.dto';
import { BrokerPositionDTO } from '../../shared/dto/broker-position.dto';
import { SessionHealth } from '../../shared/enums/session-health.enum';

/**
 * BrokerAdapterInterface v2
 *
 * Core contract every broker adapter MUST implement.
 * Enriched with:
 *  - broker_id identity
 *  - session health introspection
 *  - optional live payout matrix hook (if broker publishes payouts)
 *  - optional event callbacks (balance, position close, session state)
 *
 * Adapters implementing this interface MUST be:
 *  - Fail-closed (throw / reject on any partially-confirmed state)
 *  - Idempotent-aware (respect broker_request_id for retries)
 *  - Observable (emit session health transitions via getSessionHealth)
 */
export interface BrokerAdapterInterface {
  /** Stable identifier, e.g. 'IQ_OPTION', 'OLYMP_TRADE', 'BINOMO', 'EXPERT_OPTION', 'FAKE'. */
  getBrokerId(): string;

  /** Current session health. Must never throw. */
  getSessionHealth(): SessionHealth;

  /** Open / authenticate session for the given account. Throws on failure. */
  connectSession(accountId: string): Promise<void>;

  /** Graceful shutdown. Must not throw. */
  disconnectSession(accountId: string): Promise<void>;

  /** Place an order. Must resolve with ACK/REJECT/TIMEOUT, never hang. */
  sendOrder(request: BrokerOrderRequestDTO): Promise<BrokerOrderAckDTO>;

  /** List open positions for reconciliation. */
  getOpenPositions(accountId: string): Promise<BrokerPositionDTO[]>;

  /** Current balance. Returns 0 if session not authenticated (never throws). */
  getBalance(accountId: string): Promise<number>;

  /** Optional: live payout ratio per symbol+expiry. */
  getPayoutRatio?(symbol: string, expiryMinutes: number): Promise<number | null>;

  /** Optional: last recorded round-trip latency in ms (ACK or heartbeat). */
  getLastLatencyMs?(): number | null;
}

export const BROKER_ADAPTER = 'BROKER_ADAPTER';
