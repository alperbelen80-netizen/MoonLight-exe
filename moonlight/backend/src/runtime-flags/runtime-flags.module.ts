import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Logger,
  Module,
  OnModuleInit,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { EventEmitter } from 'events';
import { SecurityModule } from '../security/security.module';
import { SecretsStoreService } from '../security/secrets-store.service';

/**
 * V2.6-7 Runtime Flags Module
 *
 * Replaces the need for the operator to edit `.env` + restart the backend
 * to toggle live-trading safety switches. Flags are:
 *
 *   1. **Persisted** in the Credentials Vault under the reserved key
 *      prefix `MOONLIGHT_FLAG/<name>` so they survive restarts and
 *      inherit the vault's encryption-at-rest (keytar or AES-256-GCM).
 *   2. **Hot-reloadable** — `process.env[<name>]` is mutated in-place on
 *      save; any code path that reads `process.env.FLAG_X` on each
 *      invocation (most of our broker/router code does) picks up the
 *      new value immediately.
 *   3. **Emitter-backed** — services that cache env values can subscribe
 *      via `RuntimeFlagsService.onChange(cb)` to invalidate caches.
 *   4. **Audit-trailed** — every write logs `actor`, `timestamp`, `old`,
 *      `new` into the vault's audit trail and into our own ring buffer.
 *
 * Endpoints (all LOOPBACK-only, same guard as the secrets controller):
 *   GET  /api/flags            — list all registered flags + values + metadata
 *   PUT  /api/flags/:name      — set a flag ({ value: string })
 *   POST /api/flags/reset      — reset all flags to their default values
 *   GET  /api/flags/audit      — last 100 changes
 *
 * Registered flags (curated list — prevents typos + exposes intent):
 *   - BROKER_IQOPTION_REAL_ENABLED       (bool, default: false)
 *   - BROKER_DOM_AUTOMATION_ENABLED      (bool, default: false)
 *   - BROKER_DOM_LIVE_ORDERS             (bool, default: false)
 *   - BROKER_DOM_ALLOW_LIVE_REAL         (bool, default: false) ⚠ MONEY
 *   - BROKER_DOM_MAX_STAKE               (number string, default: '25')
 *   - LIVE_SIGNAL_ENABLED                (bool, default: false)
 *   - LIVE_SIGNAL_AUTO_START             (bool, default: false)
 *   - PAYOUT_PROVIDER                    (enum, default: 'STATIC')
 *   - BROKER_ROUTING_PRIORITY            (csv, default: '')
 *   - MOONLIGHT_AUTO_UPDATE_ENABLED      (bool, default: '')
 *
 * Fail-safe: unknown flag names are rejected; `BROKER_DOM_ALLOW_LIVE_REAL`
 * requires an explicit `{ acknowledge_real_money: true }` payload field.
 */

export type FlagType = 'bool' | 'number' | 'enum' | 'csv';

export interface FlagDefinition {
  name: string;
  label: string;
  description: string;
  type: FlagType;
  default: string;
  allowedValues?: string[]; // for 'enum'
  requiresAcknowledge?: boolean; // for BROKER_DOM_ALLOW_LIVE_REAL
  dangerous?: boolean;
}

export interface FlagValue {
  name: string;
  value: string;
  isDefault: boolean;
  definition: FlagDefinition;
}

export interface FlagAuditEntry {
  name: string;
  oldValue: string;
  newValue: string;
  actor: string;
  at: string;
}

const VAULT_PREFIX = 'MOONLIGHT_FLAG__';
const AUDIT_MAX = 200;

export const REGISTERED_FLAGS: FlagDefinition[] = [
  {
    name: 'BROKER_IQOPTION_REAL_ENABLED',
    label: 'IQ Option — Real WSS',
    description:
      'Enables the real IQ Option WebSocket adapter (requires IQ_OPTION_SSID in the vault).',
    type: 'bool',
    default: 'false',
  },
  {
    name: 'BROKER_DOM_AUTOMATION_ENABLED',
    label: 'DOM Automation (Olymp/Binomo/Expert)',
    description:
      'Boots the headless Playwright session manager so DOM brokers can connect.',
    type: 'bool',
    default: 'false',
  },
  {
    name: 'BROKER_DOM_LIVE_ORDERS',
    label: 'DOM — Live Click',
    description:
      'When OFF, DOM brokers dry-run (no real click). When ON, they really click — still gated by pre-flight safety checks.',
    type: 'bool',
    default: 'false',
    dangerous: true,
  },
  {
    name: 'BROKER_DOM_ALLOW_LIVE_REAL',
    label: 'DOM — Allow Real-Money Account ⚠',
    description:
      'Bypass the demo-account pre-flight. This will click trades against a real-money broker account. DO NOT enable unless you intend to risk real money.',
    type: 'bool',
    default: 'false',
    dangerous: true,
    requiresAcknowledge: true,
  },
  {
    name: 'BROKER_DOM_MAX_STAKE',
    label: 'DOM — Max Stake Cap',
    description:
      'Absolute per-trade stake cap enforced before every live click. Any trade above this is rejected with DOM_MAX_STAKE_EXCEEDED.',
    type: 'number',
    default: '25',
  },
  {
    name: 'LIVE_SIGNAL_ENABLED',
    label: 'Live Signal Engine',
    description:
      'Enables the continuous live-signal pump (produces canonical signals from the live data feed).',
    type: 'bool',
    default: 'false',
  },
  {
    name: 'LIVE_SIGNAL_AUTO_START',
    label: 'Live Signal — Auto Start',
    description:
      'If both this and LIVE_SIGNAL_ENABLED are true, the pump starts automatically at app boot.',
    type: 'bool',
    default: 'false',
  },
  {
    name: 'PAYOUT_PROVIDER',
    label: 'Payout Matrix Provider',
    description:
      'Source of payout ratios used by EV calculations + routing. DYNAMIC reads from the live IQ Option WSS stream; STATIC uses the shipped matrix.',
    type: 'enum',
    default: 'STATIC',
    allowedValues: ['STATIC', 'BROKER_API', 'DYNAMIC'],
  },
  {
    name: 'BROKER_ROUTING_PRIORITY',
    label: 'Broker Routing Priority',
    description:
      'CSV of broker IDs in order of preference. Empty → default order (IQ_OPTION, OLYMP_TRADE, BINOMO, EXPERT_OPTION, FAKE).',
    type: 'csv',
    default: '',
  },
  {
    name: 'MOONLIGHT_AUTO_UPDATE_ENABLED',
    label: 'Auto-Update',
    description:
      'Enables electron-updater (GitHub Releases feed). Defaults: ON in packaged app, OFF in dev. Set explicitly to override.',
    type: 'bool',
    default: '',
  },
];

function isLoopback(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('127.') ||
    ip.startsWith('::ffff:127.')
  );
}

function assertLoopback(req: Request): void {
  const ip = req.ip ?? req.socket?.remoteAddress ?? '';
  if (!isLoopback(ip)) {
    throw new ForbiddenException(`runtime flags API is localhost-only (seen=${ip})`);
  }
}

@Injectable()
export class RuntimeFlagsService implements OnModuleInit {
  private readonly logger = new Logger(RuntimeFlagsService.name);
  private readonly audit: FlagAuditEntry[] = [];
  private readonly emitter = new EventEmitter();

  constructor(private readonly secrets: SecretsStoreService) {}

  async onModuleInit(): Promise<void> {
    // Warm-load all registered flags from the vault into process.env so
    // downstream code paths see persisted values on the first tick.
    for (const def of REGISTERED_FLAGS) {
      try {
        const stored = await this.secrets.get(
          VAULT_PREFIX + def.name,
          'runtime-flags-boot',
        );
        if (stored !== null && stored !== undefined) {
          process.env[def.name] = stored;
          this.logger.log(`flag loaded from vault: ${def.name}=${stored}`);
        }
      } catch (err) {
        this.logger.warn(
          `flag ${def.name} warm-load failed: ${(err as Error).message}`,
        );
      }
    }
  }

  list(): FlagValue[] {
    return REGISTERED_FLAGS.map((def) => {
      const envValue = process.env[def.name];
      const value = envValue ?? def.default;
      return {
        name: def.name,
        value,
        isDefault: envValue === undefined || envValue === def.default,
        definition: def,
      };
    });
  }

  async set(
    name: string,
    newValue: string,
    actor: string,
    ack?: boolean,
  ): Promise<FlagValue> {
    const def = REGISTERED_FLAGS.find((d) => d.name === name);
    if (!def) throw new Error(`unknown flag: ${name}`);

    // Validation
    if (def.type === 'bool' && !['true', 'false', ''].includes(newValue)) {
      throw new Error(`flag ${name} is bool; expected "true" | "false"`);
    }
    if (def.type === 'number') {
      if (newValue !== '' && !Number.isFinite(Number(newValue))) {
        throw new Error(`flag ${name} is number; got non-numeric "${newValue}"`);
      }
    }
    if (def.type === 'enum' && newValue !== '') {
      if (!def.allowedValues?.includes(newValue)) {
        throw new Error(
          `flag ${name} must be one of [${def.allowedValues?.join(', ')}]`,
        );
      }
    }
    if (def.requiresAcknowledge && newValue === 'true' && !ack) {
      throw new Error(
        `flag ${name} requires acknowledge_real_money=true in payload`,
      );
    }

    const oldValue = process.env[name] ?? def.default;
    // Persist to vault so it survives restart
    await this.secrets.set(VAULT_PREFIX + name, newValue, `flags:${actor}`);
    // Hot-reload
    process.env[name] = newValue;

    const entry: FlagAuditEntry = {
      name,
      oldValue,
      newValue,
      actor,
      at: new Date().toISOString(),
    };
    this.audit.push(entry);
    if (this.audit.length > AUDIT_MAX) {
      this.audit.splice(0, this.audit.length - AUDIT_MAX);
    }
    this.logger.log(
      `flag changed: ${name} ${oldValue} → ${newValue} by ${actor}`,
    );
    this.emitter.emit('change', entry);

    return {
      name,
      value: newValue,
      isDefault: newValue === def.default,
      definition: def,
    };
  }

  async reset(actor: string): Promise<number> {
    let count = 0;
    for (const def of REGISTERED_FLAGS) {
      const current = process.env[def.name];
      if (current !== def.default) {
        try {
          await this.secrets.delete(VAULT_PREFIX + def.name, `flags:${actor}`);
        } catch {
          /* ignore — might not exist */
        }
        process.env[def.name] = def.default;
        this.audit.push({
          name: def.name,
          oldValue: current ?? '',
          newValue: def.default,
          actor,
          at: new Date().toISOString(),
        });
        this.emitter.emit('change', { name: def.name });
        count++;
      }
    }
    this.logger.warn(`reset ${count} flags to defaults by ${actor}`);
    return count;
  }

  getAudit(limit = 100): FlagAuditEntry[] {
    return this.audit.slice(-limit).reverse();
  }

  onChange(cb: (entry: FlagAuditEntry) => void): () => void {
    this.emitter.on('change', cb);
    return () => this.emitter.off('change', cb);
  }
}

interface SetFlagBody {
  value: string;
  actor?: string;
  acknowledge_real_money?: boolean;
}

@Controller('flags')
export class RuntimeFlagsController {
  constructor(private readonly svc: RuntimeFlagsService) {}

  @Get()
  list(@Req() req: Request): FlagValue[] {
    assertLoopback(req);
    return this.svc.list();
  }

  @Put(':name')
  async set(
    @Req() req: Request,
    @Body() body: SetFlagBody,
  ): Promise<FlagValue> {
    assertLoopback(req);
    const name = req.params.name;
    const actor =
      body.actor ?? (String(req.headers['x-moonlight-actor'] ?? '') || 'ui');
    return this.svc.set(
      name,
      String(body.value ?? ''),
      actor,
      body.acknowledge_real_money === true,
    );
  }

  @Post('reset')
  async reset(
    @Req() req: Request,
    @Body() body: { actor?: string },
  ): Promise<{ reset: number }> {
    assertLoopback(req);
    const actor = body.actor ?? 'ui';
    const count = await this.svc.reset(actor);
    return { reset: count };
  }

  @Get('audit')
  audit(@Req() req: Request): FlagAuditEntry[] {
    assertLoopback(req);
    return this.svc.getAudit(100);
  }
}

@Module({
  imports: [SecurityModule],
  controllers: [RuntimeFlagsController],
  providers: [RuntimeFlagsService],
  exports: [RuntimeFlagsService],
})
export class RuntimeFlagsModule {}
