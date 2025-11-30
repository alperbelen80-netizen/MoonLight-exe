import { apiGet } from './api-client';

export interface StrategyDefinitionDTO {
  id: string;
  name: string;
  description?: string;
  category: 'scalping' | 'mean_revert' | 'trend_follow' | 'other';
  version: number;
  parameters: any[];
  allowed_timeframes: string[];
  allowed_symbols?: string[];
  tags?: string[];
}

export async function getStrategyDefinitions(): Promise<StrategyDefinitionDTO[]> {
  return apiGet<StrategyDefinitionDTO[]>('/strategy/list');
}
