import { apiGet } from './api-client';
import { DataHealthMatrixDTO } from '../lib/types';

export async function getDataHealthMatrix(): Promise<DataHealthMatrixDTO> {
  return apiGet<DataHealthMatrixDTO>('/data/health/matrix');
}
