import { Injectable, Logger } from '@nestjs/common';
import { M3DecisionDTO, M3Mode, M3FinalAction } from '../shared/dto/m3-decision.dto';
import { TripleCheckResultDTO } from '../shared/dto/uncertainty.dto';

@Injectable()
export class M3DefensiveService {
  private readonly logger = new Logger(M3DefensiveService.name);

  decide(params: {
    mode: M3Mode;
    tripleCheck: TripleCheckResultDTO;
  }): M3DecisionDTO {
    const { mode, tripleCheck } = params;

    let finalAction: M3FinalAction;

    if (mode === M3Mode.ANALYSIS) {
      finalAction = M3FinalAction.ABSTAIN;
    } else if (mode === M3Mode.GUARD) {
      if (tripleCheck.level === 'HIGH' || tripleCheck.level === 'MEDIUM') {
        finalAction = M3FinalAction.HUMAN_APPROVAL;
      } else {
        finalAction = M3FinalAction.EXECUTE;
      }
    } else {
      if (tripleCheck.level === 'HIGH') {
        finalAction = M3FinalAction.ABSTAIN;
      } else {
        finalAction = M3FinalAction.EXECUTE;
      }
    }

    this.logger.log(
      `M3 Decision: mode=${mode}, level=${tripleCheck.level}, action=${finalAction}`,
    );

    return {
      mode,
      uncertainty_score: tripleCheck.uncertainty_score,
      uncertainty_level: tripleCheck.level,
      final_action: finalAction,
    };
  }
}
