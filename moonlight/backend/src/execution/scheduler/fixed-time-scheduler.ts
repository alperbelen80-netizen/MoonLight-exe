import { Injectable, Logger } from '@nestjs/common';
import {
  ScheduleRequestDTO,
  BrokerProductConfig,
} from '../../shared/dto/schedule-request.dto';
import {
  ScheduleResultDTO,
  ScheduleStatus,
} from '../../shared/dto/schedule-result.dto';
import { CanonicalSignalDTO } from '../../shared/dto/canonical-signal.dto';

const TF_TO_DURATION_MS: Record<string, number> = {
  '1s': 1000,
  '3s': 3000,
  '5s': 5000,
  '15s': 15000,
  '30s': 30000,
  '1m': 60000,
  '5m': 300000,
  '15m': 900000,
  '30m': 1800000,
  '1h': 3600000,
  '4h': 14400000,
  '1d': 86400000,
};

@Injectable()
export class FixedTimeScheduler {
  private readonly logger = new Logger(FixedTimeScheduler.name);

  private readonly SAFETY_MARGIN_MS = 150;
  private readonly BROKER_OFFSET_MS = 50;

  scheduleFixedTime(request: ScheduleRequestDTO): ScheduleResultDTO {
    const { signal, broker_config, now_utc } = request;
    const tfDurationMs = TF_TO_DURATION_MS[signal.tf];

    if (!tfDurationMs) {
      return {
        status: ScheduleStatus.UNSUPPORTED_TF,
        reason_codes: [`Unsupported timeframe: ${signal.tf}`],
      };
    }

    const signalTimestamp = new Date(signal.ts).getTime();
    const barCloseTimestamp = signalTimestamp + tfDurationMs;
    const nowTimestamp = new Date(now_utc).getTime();

    const executionTimestamp =
      barCloseTimestamp - this.SAFETY_MARGIN_MS - this.BROKER_OFFSET_MS;

    const timeUntilExecution = executionTimestamp - nowTimestamp;

    if (timeUntilExecution < signal.latency_budget_ms) {
      this.logger.warn(
        `Signal ${signal.signal_id} too late: time_until_execution ${timeUntilExecution}ms < latency_budget ${signal.latency_budget_ms}ms`,
      );
      return {
        status: ScheduleStatus.TOO_LATE,
        reason_codes: [
          `Insufficient time: ${timeUntilExecution}ms < latency_budget ${signal.latency_budget_ms}ms`,
        ],
        metadata: {
          time_until_execution_ms: timeUntilExecution,
          latency_budget_ms: signal.latency_budget_ms,
        },
      };
    }

    const selectedSlot = this.selectBestSlot(
      broker_config.available_expiry_slots_minutes,
      signal,
    );

    if (!selectedSlot) {
      return {
        status: ScheduleStatus.INVALID_SLOT,
        reason_codes: ['No valid expiry slot available'],
      };
    }

    const scheduled_execution_time_utc = new Date(
      executionTimestamp,
    ).toISOString();

    this.logger.log(
      `Signal ${signal.signal_id} scheduled: execution_time=${scheduled_execution_time_utc}, slot=${selectedSlot}m`,
    );

    return {
      status: ScheduleStatus.SCHEDULED,
      scheduled_execution_time_utc,
      slot_minutes: selectedSlot,
      metadata: {
        bar_close_utc: new Date(barCloseTimestamp).toISOString(),
        safety_margin_ms: this.SAFETY_MARGIN_MS,
        broker_offset_ms: this.BROKER_OFFSET_MS,
        time_until_execution_ms: timeUntilExecution,
      },
    };
  }

  private selectBestSlot(
    availableSlots: number[],
    signal: CanonicalSignalDTO,
  ): number | null {
    if (!availableSlots || availableSlots.length === 0) {
      return null;
    }

    const tfDurationMinutes = TF_TO_DURATION_MS[signal.tf] / 60000;

    const suitableSlots = availableSlots.filter(
      (slot) => slot >= tfDurationMinutes,
    );

    if (suitableSlots.length === 0) {
      return availableSlots[0];
    }

    return suitableSlots[0];
  }
}
