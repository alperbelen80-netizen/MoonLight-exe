import { Test, TestingModule } from '@nestjs/testing';
import { FixedTimeScheduler } from '../../../execution/scheduler/fixed-time-scheduler';
import {
  ScheduleRequestDTO,
  BrokerProductConfig,
} from '../../../shared/dto/schedule-request.dto';
import { ScheduleStatus } from '../../../shared/dto/schedule-result.dto';
import {
  CanonicalSignalDTO,
  SignalDirection,
  Environment,
  UncertaintyLevel,
} from '../../../shared/dto/canonical-signal.dto';

describe('FixedTimeScheduler', () => {
  let scheduler: FixedTimeScheduler;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FixedTimeScheduler],
    }).compile();

    scheduler = module.get<FixedTimeScheduler>(FixedTimeScheduler);
  });

  const mockSignal: CanonicalSignalDTO = {
    signal_id: 'SIG_SCHEDULE_001',
    idempotency_key: 'hash_schedule_001',
    source: 'test_strategy',
    symbol: 'XAUUSD',
    tf: '1m',
    ts: '2025-01-18T10:00:00.000Z',
    direction: SignalDirection.CALL,
    ev: 0.042,
    confidence_score: 0.72,
    valid_until: '2025-01-18T10:01:00.000Z',
    latency_budget_ms: 200,
    uncertainty_level: UncertaintyLevel.LOW,
    requested_stake: 25.0,
    schema_version: 1,
    environment: Environment.LIVE,
  };

  const mockBrokerConfig: BrokerProductConfig = {
    broker_id: 'OLYMP_TRADE',
    product: 'XAUUSD',
    available_expiry_slots_minutes: [1, 5, 15, 30, 60, 240],
  };

  it('should schedule signal with valid execution time (early signal)', () => {
    const now_utc = '2025-01-18T10:00:05.000Z';

    const request: ScheduleRequestDTO = {
      signal: mockSignal,
      broker_config: mockBrokerConfig,
      now_utc,
    };

    const result = scheduler.scheduleFixedTime(request);

    expect(result.status).toBe(ScheduleStatus.SCHEDULED);
    expect(result.scheduled_execution_time_utc).toBeDefined();
    expect(result.slot_minutes).toBeDefined();
    expect(result.slot_minutes).toBeGreaterThanOrEqual(1);
  });

  it('should return TOO_LATE when signal arrives too close to bar close', () => {
    const now_utc = '2025-01-18T10:00:59.900Z';

    const request: ScheduleRequestDTO = {
      signal: mockSignal,
      broker_config: mockBrokerConfig,
      now_utc,
    };

    const result = scheduler.scheduleFixedTime(request);

    expect(result.status).toBe(ScheduleStatus.TOO_LATE);
    expect(result.reason_codes).toBeDefined();
    expect(result.reason_codes!.some((r) => r.includes('Insufficient time'))).toBe(true);
  });

  it('should return UNSUPPORTED_TF for invalid timeframe', () => {
    const invalidSignal: CanonicalSignalDTO = {
      ...mockSignal,
      tf: '3x' as any,
    };

    const request: ScheduleRequestDTO = {
      signal: invalidSignal,
      broker_config: mockBrokerConfig,
      now_utc: '2025-01-18T10:00:05.000Z',
    };

    const result = scheduler.scheduleFixedTime(request);

    expect(result.status).toBe(ScheduleStatus.UNSUPPORTED_TF);
  });

  it('should select best expiry slot (1m TF → min 1m slot)', () => {
    const now_utc = '2025-01-18T10:00:05.000Z';

    const request: ScheduleRequestDTO = {
      signal: mockSignal,
      broker_config: mockBrokerConfig,
      now_utc,
    };

    const result = scheduler.scheduleFixedTime(request);

    expect(result.status).toBe(ScheduleStatus.SCHEDULED);
    expect(result.slot_minutes).toBeGreaterThanOrEqual(1);
  });

  it('should calculate execution_time = bar_close - safety_margin - broker_offset', () => {
    const now_utc = '2025-01-18T10:00:05.000Z';

    const request: ScheduleRequestDTO = {
      signal: mockSignal,
      broker_config: mockBrokerConfig,
      now_utc,
    };

    const result = scheduler.scheduleFixedTime(request);

    expect(result.status).toBe(ScheduleStatus.SCHEDULED);
    expect(result.metadata?.safety_margin_ms).toBe(150);
    expect(result.metadata?.broker_offset_ms).toBe(50);
    
    const barClose = new Date('2025-01-18T10:01:00.000Z').getTime();
    const expectedExecution = barClose - 150 - 50;
    const actualExecution = new Date(result.scheduled_execution_time_utc!).getTime();
    
    expect(actualExecution).toBe(expectedExecution);
  });
});
