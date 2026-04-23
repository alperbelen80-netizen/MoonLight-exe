import { Body, Controller, Get, Post } from '@nestjs/common';
import { AlertDispatcherService, AlertPayload } from './alert-dispatcher.service';

interface TestWebhookPayload extends AlertPayload {
  url?: string;
  channel?: 'discord' | 'slack' | 'telegram' | 'generic';
}

@Controller('alerts')
export class AlertsDispatcherController {
  constructor(private readonly dispatcher: AlertDispatcherService) {}

  @Get('webhooks')
  getWebhooks() {
    return {
      configured: this.dispatcher.isConfigured(),
      channels: this.dispatcher.getChannels(),
    };
  }

  @Post('test-webhook')
  async testWebhook(@Body() body: TestWebhookPayload) {
    const payload: AlertPayload = {
      title: body.title || 'MoonLight Test Alert',
      message: body.message || 'Bu bir test bildirimidir.',
      severity: body.severity || 'info',
      context: body.context || { source: 'manual-test', ts: new Date().toISOString() },
    };
    const overrides = body.url ? [{ url: body.url, channel: body.channel || 'generic' as any }] : undefined;
    return this.dispatcher.dispatch(payload, overrides);
  }
}
