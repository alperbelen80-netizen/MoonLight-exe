import { Test, TestingModule } from '@nestjs/testing';
import { TrinityOversightModule } from '../../../trinity-oversight/trinity-oversight.module';
import { TrinityOversightService } from '../../../trinity-oversight/trinity-oversight.service';
import { ResourceBrokerService } from '../../../trinity-oversight/resource-broker.service';
import { OversightVerdict } from '../../../trinity-oversight/shared/trinity.enums';

describe('TrinityOversightService (integration stub)', () => {
  let mod: TestingModule;
  let trinity: TrinityOversightService;
  let broker: ResourceBrokerService;

  beforeAll(async () => {
    mod = await Test.createTestingModule({
      imports: [TrinityOversightModule],
    }).compile();
    trinity = mod.get(TrinityOversightService);
    broker = mod.get(ResourceBrokerService);
  });

  afterAll(async () => {
    await mod.close();
  });

  it('getStatus returns all three eyes + consensus', async () => {
    jest.spyOn(broker, 'sample').mockReturnValue({ cpuUsagePct: 10, memUsagePct: 20 });
    const status = await trinity.getStatus();
    expect(status.eye1.eye).toBe('EYE_1_SYSTEM_OBSERVER');
    expect(status.eye2.eye).toBe('EYE_2_DECISION_AUDITOR');
    expect(status.eye3.eye).toBe('EYE_3_TOPOLOGY_GOVERNOR');
    expect([
      OversightVerdict.OK,
      OversightVerdict.WARN,
      OversightVerdict.HALT,
    ]).toContain(status.consensus);
  });

  it('returns HALT consensus when EYE-1 overspends budget', async () => {
    jest.spyOn(broker, 'sample').mockReturnValue({ cpuUsagePct: 99, memUsagePct: 99 });
    const status = await trinity.getStatus();
    expect(status.eye1.verdict).toBe(OversightVerdict.HALT);
    expect(status.consensus).toBe(OversightVerdict.HALT);
  });
});
