import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ConfigSnapshot } from '../../database/entities/config-snapshot.entity';
import { ConfigSnapshotDTO, ConfigSnapshotScope } from '../../shared/dto/config-snapshot.dto';
import { BacktestRunRequestDTO } from '../../shared/dto/backtest.dto';
import { RiskProfileDTO } from '../../shared/dto/risk-profile.dto';
import { StrategyDefinitionDTO } from '../../shared/dto/strategy-definition.dto';
import { PresetStrategyDTO } from '../../shared/dto/preset-strategy.dto';

@Injectable()
export class ConfigSnapshotService {
  private readonly logger = new Logger(ConfigSnapshotService.name);

  constructor(
    @InjectRepository(ConfigSnapshot)
    private readonly snapshotRepo: Repository<ConfigSnapshot>,
  ) {}

  async createBacktestRunSnapshot(params: {
    runId: string;
    request: BacktestRunRequestDTO;
    riskProfile: RiskProfileDTO;
    strategies: StrategyDefinitionDTO[];
    presets: PresetStrategyDTO[];
    createdBy?: string;
  }): Promise<ConfigSnapshotDTO> {
    const { runId, request, riskProfile, strategies, presets, createdBy } = params;

    const snapshotId = `SNAPSHOT_${uuidv4()}`;

    const payload = {
      runId,
      request,
      riskProfile,
      strategyIds: request.strategy_ids,
      strategies,
      presets,
    };

    const snapshot = this.snapshotRepo.create({
      id: snapshotId,
      scope: ConfigSnapshotScope.BACKTEST_RUN,
      ref_id: runId,
      label: `Backtest Run ${runId}`,
      payload_json: JSON.stringify(payload, null, 2),
      created_at_utc: new Date(),
      created_by: createdBy || 'system',
    });

    await this.snapshotRepo.save(snapshot);

    this.logger.log(`Config snapshot created: ${snapshotId} for run ${runId}`);

    return this.mapToDTO(snapshot);
  }

  async getSnapshotByRef(
    scope: ConfigSnapshotScope,
    refId: string,
  ): Promise<ConfigSnapshotDTO | null> {
    const snapshot = await this.snapshotRepo.findOne({
      where: { scope, ref_id: refId },
    });

    if (!snapshot) {
      return null;
    }

    return this.mapToDTO(snapshot);
  }

  private mapToDTO(snapshot: ConfigSnapshot): ConfigSnapshotDTO {
    return {
      id: snapshot.id,
      scope: snapshot.scope as ConfigSnapshotScope,
      ref_id: snapshot.ref_id,
      label: snapshot.label,
      payload_json: snapshot.payload_json,
      created_at_utc: snapshot.created_at_utc.toISOString(),
      created_by: snapshot.created_by,
    };
  }
}
