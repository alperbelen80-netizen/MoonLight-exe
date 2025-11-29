import { Injectable, Logger } from '@nestjs/common';
import { TripleCheckInputDTO, TripleCheckResultDTO } from '../../shared/dto/uncertainty.dto';

@Injectable()
export class TripleCheckService {
  private readonly logger = new Logger(TripleCheckService.name);

  private readonly w1 = 0.3;
  private readonly w2 = 0.4;
  private readonly w3 = 0.3;

  evaluate(input: TripleCheckInputDTO): TripleCheckResultDTO {
    const u1Score = this.calculateU1(input);
    const u2Score = this.calculateU2(input);
    const u3Score = this.calculateU3(input);

    const uncertaintyScore = this.w1 * u1Score + this.w2 * u2Score + this.w3 * u3Score;

    let level: string;
    if (uncertaintyScore < 0.33) {
      level = 'LOW';
    } else if (uncertaintyScore < 0.66) {
      level = 'MEDIUM';
    } else {
      level = 'HIGH';
    }

    return {
      u1_score: u1Score,
      u2_score: u2Score,
      u3_score: u3Score,
      uncertainty_score: uncertaintyScore,
      level,
    };
  }

  private calculateU1(input: TripleCheckInputDTO): number {
    return 0.15;
  }

  private calculateU2(input: TripleCheckInputDTO): number {
    if (input.data_quality?.quality_grade === 'A') {
      return 0.05;
    }
    if (input.data_quality?.quality_grade === 'B') {
      return 0.15;
    }
    if (input.data_quality?.quality_grade === 'C') {
      return 0.30;
    }
    return 0.50;
  }

  private calculateU3(input: TripleCheckInputDTO): number {
    if (!input.model_stats) {
      return 0.20;
    }

    const { live_wr, backtest_wr } = input.model_stats;
    const delta = Math.abs(live_wr - backtest_wr);

    if (delta < 0.05) {
      return 0.10;
    }
    if (delta < 0.10) {
      return 0.25;
    }
    return 0.40;
  }
}
