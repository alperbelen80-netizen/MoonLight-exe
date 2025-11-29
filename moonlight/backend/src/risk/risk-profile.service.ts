import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiskProfile } from '../../database/entities/risk-profile.entity';
import { RiskProfileDTO } from '../../shared/dto/risk-profile.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RiskProfileService {
  private readonly logger = new Logger(RiskProfileService.name);

  constructor(
    @InjectRepository(RiskProfile)
    private readonly riskProfileRepo: Repository<RiskProfile>,
  ) {}

  async getById(id: string): Promise<RiskProfileDTO | null> {
    const profile = await this.riskProfileRepo.findOne({ where: { id } });
    if (!profile) {
      return null;
    }
    return this.mapToDTO(profile);
  }

  async getDefaultProfile(): Promise<RiskProfileDTO> {
    const existing = await this.riskProfileRepo.findOne({
      where: { name: 'DEFAULT_BACKTEST_PROFILE' },
    });

    if (existing) {
      return this.mapToDTO(existing);
    }

    const defaultProfile = this.riskProfileRepo.create({
      id: `PROFILE_${uuidv4()}`,
      name: 'DEFAULT_BACKTEST_PROFILE',
      description: 'Default risk profile for backtesting',
      max_per_trade_pct: 0.02,
      max_daily_loss_pct: 0.1,
      max_concurrent_trades: 5,
      max_exposure_per_symbol_pct: 0.3,
      enabled: true,
      created_at_utc: new Date(),
      updated_at_utc: new Date(),
    });

    await this.riskProfileRepo.save(defaultProfile);

    this.logger.log('Created DEFAULT_BACKTEST_PROFILE');

    return this.mapToDTO(defaultProfile);
  }

  private mapToDTO(profile: RiskProfile): RiskProfileDTO {
    return {
      id: profile.id,
      name: profile.name,
      description: profile.description,
      max_per_trade_pct: profile.max_per_trade_pct,
      max_daily_loss_pct: profile.max_daily_loss_pct,
      max_concurrent_trades: profile.max_concurrent_trades,
      max_exposure_per_symbol_pct: profile.max_exposure_per_symbol_pct,
      enabled: profile.enabled,
      created_at_utc: profile.created_at_utc.toISOString(),
      updated_at_utc: profile.updated_at_utc.toISOString(),
    };
  }
}
