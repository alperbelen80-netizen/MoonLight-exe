import { Body, Controller, Get, Post } from '@nestjs/common';

export type RiskProfileId = 'conservative' | 'moderate' | 'aggressive' | 'custom';

export interface RiskProfile {
  id: RiskProfileId;
  label: string;
  description: string;
  r_per_trade_pct: number; // risk per trade (%)
  max_concurrent: number;
  max_daily_loss_pct: number;
  confidence_floor: number; // 0..1
  require_ai_approval: boolean;
}

const PRESETS: Record<Exclude<RiskProfileId, 'custom'>, RiskProfile> = {
  conservative: {
    id: 'conservative',
    label: 'Conservative',
    description: 'Düşük risk, yüksek filtreleme. AI onayı zorunlu.',
    r_per_trade_pct: 0.5,
    max_concurrent: 1,
    max_daily_loss_pct: 2,
    confidence_floor: 0.75,
    require_ai_approval: true,
  },
  moderate: {
    id: 'moderate',
    label: 'Moderate',
    description: 'Dengeli risk, AI onayı önerilen (zorunlu değil).',
    r_per_trade_pct: 1,
    max_concurrent: 2,
    max_daily_loss_pct: 3,
    confidence_floor: 0.65,
    require_ai_approval: false,
  },
  aggressive: {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'Yüksek frekans, düşük filtre. Drawdown riski yüksek.',
    r_per_trade_pct: 2,
    max_concurrent: 4,
    max_daily_loss_pct: 5,
    confidence_floor: 0.55,
    require_ai_approval: false,
  },
};

// Simple in-memory store; persisted via env fallback. Real impl
// could be extended to a DB-backed singleton; this is enough for MVP.
let current: RiskProfile =
  (PRESETS as Record<string, RiskProfile>)[(process.env.RISK_PROFILE as string) || 'moderate'] ||
  PRESETS.moderate;

@Controller('risk/profile')
export class RiskProfileController {
  @Get('presets')
  listPresets() {
    return { presets: Object.values(PRESETS) };
  }

  @Get()
  get() {
    return { current };
  }

  @Post()
  set(@Body() body: Partial<RiskProfile> & { id: RiskProfileId }) {
    if (!body?.id) throw new Error('id is required');
    if (body.id === 'custom') {
      current = {
        id: 'custom',
        label: body.label || 'Custom',
        description: body.description || 'Kullanıcı tanımlı profil.',
        r_per_trade_pct: this.clamp(body.r_per_trade_pct, 0.1, 10, 1),
        max_concurrent: this.clamp(body.max_concurrent, 1, 20, 2),
        max_daily_loss_pct: this.clamp(body.max_daily_loss_pct, 0.5, 25, 3),
        confidence_floor: this.clamp(body.confidence_floor, 0, 1, 0.6),
        require_ai_approval: Boolean(body.require_ai_approval),
      };
    } else {
      const preset = PRESETS[body.id];
      if (!preset) throw new Error('unknown risk profile id');
      current = { ...preset };
    }
    return { current };
  }

  private clamp(v: any, min: number, max: number, fallback: number): number {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }
}
