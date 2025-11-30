import { Test, TestingModule } from '@nestjs/testing';
import { EnvironmentService } from '../../../shared/config/environment.service';

describe('EnvironmentService', () => {
  let service: EnvironmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EnvironmentService],
    }).compile();

    service = module.get<EnvironmentService>(EnvironmentService);
  });

  it('should return SANDBOX when env not set', () => {
    delete process.env.MOONLIGHT_ENVIRONMENT;

    const newService = new EnvironmentService();
    expect(newService.getEnvironment()).toBe('SANDBOX');
    expect(newService.isSandbox()).toBe(true);
    expect(newService.isLive()).toBe(false);
  });

  it('should return LIVE when env set to LIVE', () => {
    process.env.MOONLIGHT_ENVIRONMENT = 'LIVE';

    const newService = new EnvironmentService();
    expect(newService.getEnvironment()).toBe('LIVE');
    expect(newService.isLive()).toBe(true);
    expect(newService.isSandbox()).toBe(false);

    delete process.env.MOONLIGHT_ENVIRONMENT;
  });
});
