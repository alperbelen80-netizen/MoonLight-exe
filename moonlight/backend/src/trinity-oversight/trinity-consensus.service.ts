// Trinity consensus: 2-of-3 majority; any HALT is sticky.

import { Injectable } from '@nestjs/common';
import { OversightVerdict } from './shared/trinity.enums';

@Injectable()
export class TrinityConsensusService {
  consensus(verdicts: OversightVerdict[]): OversightVerdict {
    if (verdicts.length === 0) return OversightVerdict.OK;
    // Fail-closed: any HALT wins.
    if (verdicts.includes(OversightVerdict.HALT)) return OversightVerdict.HALT;

    const counts: Record<OversightVerdict, number> = {
      [OversightVerdict.OK]: 0,
      [OversightVerdict.WARN]: 0,
      [OversightVerdict.HALT]: 0,
    };
    for (const v of verdicts) counts[v] = (counts[v] || 0) + 1;

    // If WARN majority → WARN; else OK.
    if (counts[OversightVerdict.WARN] >= 2) return OversightVerdict.WARN;
    return OversightVerdict.OK;
  }
}
