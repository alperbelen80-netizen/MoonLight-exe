import { IsEnum, IsNumber, IsString, Min, Max } from 'class-validator';
import { UncertaintyLevel } from './uncertainty.dto';

export enum M3Mode {
  AUTO = 'AUTO',
  GUARD = 'GUARD',
  ANALYSIS = 'ANALYSIS',
}

export enum M3FinalAction {
  EXECUTE = 'EXECUTE',
  ABSTAIN = 'ABSTAIN',
  HUMAN_APPROVAL = 'HUMAN_APPROVAL',
}

export class M3DecisionDTO {
  @IsEnum(M3Mode)
  mode: M3Mode;

  @IsNumber()
  @Min(0)
  @Max(1)
  uncertainty_score: number;

  @IsEnum(UncertaintyLevel)
  uncertainty_level: UncertaintyLevel;

  @IsEnum(M3FinalAction)
  final_action: M3FinalAction;
}
