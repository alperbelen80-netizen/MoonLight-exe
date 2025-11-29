import { Injectable, Inject, Logger } from '@nestjs/common';
import { BrokerOrderRequestDTO, BrokerOrderAckDTO } from '../../shared/dto/broker-order.dto';
import { BrokerAdapterInterface, BROKER_ADAPTER } from '../adapters/broker-adapter.interface';
import { getRetryDelaysMs, sleep } from './order-retry-policy';

interface CachedOrderResult {
  ack: BrokerOrderAckDTO;
  stored_at: number;
}

@Injectable()
export class IdempotentOrderService {
  private readonly logger = new Logger(IdempotentOrderService.name);
  private cache: Map<string, CachedOrderResult> = new Map();

  constructor(
    @Inject(BROKER_ADAPTER)
    private readonly brokerAdapter: BrokerAdapterInterface,
  ) {}

  async sendOrderIdempotent(
    request: BrokerOrderRequestDTO,
    options?: { maxAttempts?: number; dedupTtlMs?: number },
  ): Promise<BrokerOrderAckDTO> {
    const maxAttempts = options?.maxAttempts || 3;
    const dedupTtlMs = options?.dedupTtlMs || 60000;
    const orderKey = request.order_key;

    const cached = this.cache.get(orderKey);
    if (cached) {
      const age = Date.now() - cached.stored_at;
      if (age < dedupTtlMs) {
        this.logger.log(
          `Order ${orderKey} found in cache (age: ${age}ms), returning cached result`,
        );
        return cached.ack;
      } else {
        this.cache.delete(orderKey);
      }
    }

    const retryDelays = getRetryDelaysMs(maxAttempts);
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        this.logger.log(
          `Sending order (attempt ${attempt + 1}/${maxAttempts}): ${orderKey}`,
        );

        const ack = await this.brokerAdapter.sendOrder(request);

        this.cache.set(orderKey, {
          ack,
          stored_at: Date.now(),
        });

        this.logger.log(
          `Order ${orderKey} completed with status: ${ack.status}`,
        );

        return ack;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(
          `Order ${orderKey} attempt ${attempt + 1} failed: ${error?.message || String(error)}`,
        );

        if (attempt < maxAttempts - 1) {
          const delay = retryDelays[attempt];
          this.logger.log(`Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }

    this.logger.error(
      `Order ${orderKey} failed after ${maxAttempts} attempts`,
    );
    throw lastError || new Error('Order failed after max retries');
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size;
  }
}
