import { AlertDispatcherService } from '../../../alerts/alert-dispatcher.service';

describe('AlertDispatcherService', () => {
  let original: string | undefined;
  beforeEach(() => {
    original = process.env.ALERT_WEBHOOKS;
  });
  afterEach(() => {
    if (original !== undefined) process.env.ALERT_WEBHOOKS = original;
    else delete process.env.ALERT_WEBHOOKS;
  });

  it('reports not configured when ALERT_WEBHOOKS is unset', () => {
    delete process.env.ALERT_WEBHOOKS;
    const svc = new AlertDispatcherService();
    expect(svc.isConfigured()).toBe(false);
    expect(svc.getChannels()).toEqual([]);
  });

  it('parses channel-prefixed webhooks correctly', () => {
    process.env.ALERT_WEBHOOKS = 'discord:https://discord.com/api/webhooks/1/abc,slack:https://hooks.slack.com/xyz';
    const svc = new AlertDispatcherService();
    const ch = svc.getChannels();
    expect(ch).toHaveLength(2);
    expect(ch[0].channel).toBe('discord');
    expect(ch[1].channel).toBe('slack');
  });

  it('falls back to generic channel when no prefix present', () => {
    process.env.ALERT_WEBHOOKS = 'https://example.com/hook';
    const svc = new AlertDispatcherService();
    expect(svc.getChannels()[0].channel).toBe('generic');
  });

  it('formats Discord embeds with severity colors', () => {
    delete process.env.ALERT_WEBHOOKS;
    const svc = new AlertDispatcherService();
    const out = svc.formatFor('discord', { title: 'T', message: 'M', severity: 'critical' });
    expect(out.embeds[0].color).toBe(0xe11d48);
    expect(out.embeds[0].title).toMatch(/T/);
  });

  it('formats Slack payloads', () => {
    delete process.env.ALERT_WEBHOOKS;
    const svc = new AlertDispatcherService();
    const out = svc.formatFor('slack', { title: 'X', message: 'Y', severity: 'info' });
    expect(out.text).toContain('X');
    expect(out.text).toContain('Y');
  });

  it('dispatch returns zero counters when no target and no override', async () => {
    delete process.env.ALERT_WEBHOOKS;
    const svc = new AlertDispatcherService();
    const res = await svc.dispatch({ title: 'A', message: 'B', severity: 'info' });
    expect(res.total).toBe(0);
    expect(res.ok).toBe(0);
  });
});
