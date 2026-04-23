import { TrinityConsensusService } from '../../../trinity-oversight/trinity-consensus.service';
import { OversightVerdict } from '../../../trinity-oversight/shared/trinity.enums';

describe('TrinityConsensusService', () => {
  const svc = new TrinityConsensusService();

  it('returns OK for empty input', () => {
    expect(svc.consensus([])).toBe(OversightVerdict.OK);
  });

  it('is fail-closed: any HALT wins', () => {
    expect(
      svc.consensus([OversightVerdict.OK, OversightVerdict.OK, OversightVerdict.HALT]),
    ).toBe(OversightVerdict.HALT);
  });

  it('returns WARN when 2-of-3 are WARN', () => {
    expect(
      svc.consensus([OversightVerdict.WARN, OversightVerdict.WARN, OversightVerdict.OK]),
    ).toBe(OversightVerdict.WARN);
  });

  it('returns OK when only one WARN', () => {
    expect(
      svc.consensus([OversightVerdict.WARN, OversightVerdict.OK, OversightVerdict.OK]),
    ).toBe(OversightVerdict.OK);
  });
});
