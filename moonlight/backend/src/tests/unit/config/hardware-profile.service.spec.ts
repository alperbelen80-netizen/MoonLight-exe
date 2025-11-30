import { Test, TestingModule } from '@nestjs/testing';
import { HardwareProfileService } from '../../../shared/config/hardware-profile.service';

describe('HardwareProfileService', () => {
  let service: HardwareProfileService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HardwareProfileService],
    }).compile();

    service = module.get<HardwareProfileService>(HardwareProfileService);
  });

  it('should return default profile when env not set', () => {
    delete process.env.HARDWARE_PROFILE;

    const profile = service.getActiveProfile();

    expect(profile.name).toBe('SAFE');
    expect(profile.maxConcurrentTrades).toBe(2);
  });

  it('should return BALANCED profile when env set', () => {
    process.env.HARDWARE_PROFILE = 'BALANCED';

    const profile = service.getActiveProfile();

    expect(profile.name).toBe('BALANCED');
    expect(profile.maxConcurrentTrades).toBe(5);
    expect(profile.maxConcurrentBacktests).toBe(3);

    delete process.env.HARDWARE_PROFILE;
  });

  it('should return MAXPOWER profile when env set', () => {
    process.env.HARDWARE_PROFILE = 'MAXPOWER';

    const profile = service.getActiveProfile();

    expect(profile.name).toBe('MAXPOWER');
    expect(profile.maxConcurrentTrades).toBe(15);

    delete process.env.HARDWARE_PROFILE;
  });
});
