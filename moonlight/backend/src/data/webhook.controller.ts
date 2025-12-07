import { Controller, Post, Param, Body, Headers, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { TradingViewWebhookAdapter } from '../data/sources/tradingview-webhook.adapter';
import { DataFeedOrchestrator } from '../data/sources/data-feed-orchestrator.service';
import { LiveCaptureService } from './capture/live-capture.service';

@Controller('webhook')
export class WebhookController {
  private readonly webhookSecret: string;

  constructor(
    private readonly dataFeedOrchestrator: DataFeedOrchestrator,
    private readonly liveCaptureService: LiveCaptureService,
  ) {
    this.webhookSecret = process.env.TRADINGVIEW_WEBHOOK_SECRET || 'moonlight_secret_change_me';
  }

  @Post('tradingview/:symbol/:timeframe')
  async handleTradingViewWebhook(
    @Param('symbol') symbol: string,
    @Param('timeframe') timeframe: string,
    @Body() payload: any,
    @Headers('x-webhook-secret') secret?: string,
  ) {
    if (secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('Invalid payload format');
    }

    const requiredFields = ['time', 'open', 'high', 'low', 'close'];
    const missingFields = requiredFields.filter((field) => payload[field] === undefined);

    if (missingFields.length > 0) {
      throw new BadRequestException(`Missing required fields: ${missingFields.join(', ')}`);
    }

    const adapter = this.dataFeedOrchestrator.getAdapter('TRADINGVIEW');

    if (adapter && adapter instanceof TradingViewWebhookAdapter) {
      adapter.handleWebhookData(symbol.toUpperCase(), timeframe, payload);
    }

    return {
      status: 'OK',
      symbol: symbol.toUpperCase(),
      timeframe,
      timestamp: new Date().toISOString(),
    };
  }

  @Post('tradingview/batch')
  async handleTradingViewBatchWebhook(
    @Body() payload: { alerts: any[] },
    @Headers('x-webhook-secret') secret?: string,
  ) {
    if (secret !== this.webhookSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (!payload.alerts || !Array.isArray(payload.alerts)) {
      throw new BadRequestException('Invalid batch payload format');
    }

    const results = [];

    for (const alert of payload.alerts) {
      try {
        const { symbol, timeframe, ...data } = alert;

        const adapter = this.dataFeedOrchestrator.getAdapter('TRADINGVIEW');

        if (adapter && adapter instanceof TradingViewWebhookAdapter) {
          adapter.handleWebhookData(symbol.toUpperCase(), timeframe, data);
        }

        results.push({
          symbol,
          timeframe,
          status: 'OK',
        });
      } catch (error: any) {
        results.push({
          symbol: alert.symbol,
          timeframe: alert.timeframe,
          status: 'ERROR',
          error: error.message,
        });
      }
    }

    return {
      processed: results.length,
      results,
    };
  }
}
