import { Injectable, Logger } from '@nestjs/common';

export type AlertChannel = 'discord' | 'slack' | 'telegram' | 'generic';

export interface AlertPayload {
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  context?: Record<string, any>;
}

/**
 * Alert Dispatcher (v1.9)
 *
 * Fans out a single alert to every configured outgoing webhook. Works
 * with Discord / Slack / Telegram formats and a generic JSON payload.
 *
 * Never throws upstream – per-channel failures are logged and the
 * overall result is returned so the caller can surface partial success.
 */
@Injectable()
export class AlertDispatcherService {
  private readonly logger = new Logger(AlertDispatcherService.name);

  private get channels(): { url: string; channel: AlertChannel }[] {
    const raw = (process.env.ALERT_WEBHOOKS || '').trim();
    if (!raw) return [];
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((entry) => {
        // format: "<channel>:<url>" or just url (defaults to generic)
        const idx = entry.indexOf(':http');
        if (idx < 0) return { channel: 'generic' as AlertChannel, url: entry };
        const channel = entry.slice(0, idx).toLowerCase() as AlertChannel;
        const url = entry.slice(idx + 1);
        return { channel, url };
      });
  }

  isConfigured(): boolean {
    return this.channels.length > 0;
  }

  getChannels(): { channel: AlertChannel; urlPreview: string }[] {
    return this.channels.map((c) => ({
      channel: c.channel,
      urlPreview: this.previewUrl(c.url),
    }));
  }

  async dispatch(
    payload: AlertPayload,
    overrides?: { url: string; channel: AlertChannel }[],
  ): Promise<{ total: number; ok: number; failed: number; details: any[] }> {
    const targets = overrides && overrides.length > 0 ? overrides : this.channels;
    if (targets.length === 0) {
      return { total: 0, ok: 0, failed: 0, details: [] };
    }
    const details: any[] = [];
    let ok = 0;
    let failed = 0;
    await Promise.all(
      targets.map(async (t) => {
        try {
          const body = this.formatFor(t.channel, payload);
          const controller = new AbortController();
          const to = setTimeout(() => controller.abort(), 8000);
          try {
            const res = await fetch(t.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
              signal: controller.signal,
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            ok += 1;
            details.push({ channel: t.channel, ok: true });
          } finally {
            clearTimeout(to);
          }
        } catch (err: any) {
          failed += 1;
          this.logger.warn(
            `Alert dispatch failed for ${t.channel} ${this.previewUrl(t.url)}: ${err?.message}`,
          );
          details.push({ channel: t.channel, ok: false, error: err?.message });
        }
      }),
    );
    return { total: targets.length, ok, failed, details };
  }

  formatFor(channel: AlertChannel, p: AlertPayload): any {
    const emoji =
      p.severity === 'critical' ? '🚨' : p.severity === 'warning' ? '⚠️' : 'ℹ️';
    const title = `${emoji} ${p.title}`;
    const ctx =
      p.context && Object.keys(p.context).length > 0
        ? '```\n' + JSON.stringify(p.context, null, 2).slice(0, 1400) + '\n```'
        : '';
    switch (channel) {
      case 'discord':
        return {
          username: 'MoonLight',
          embeds: [
            {
              title,
              description: `${p.message}${ctx ? '\n' + ctx : ''}`,
              color:
                p.severity === 'critical'
                  ? 0xe11d48
                  : p.severity === 'warning'
                  ? 0xf59e0b
                  : 0x3b82f6,
              timestamp: new Date().toISOString(),
            },
          ],
        };
      case 'slack':
        return { text: `*${title}*\n${p.message}${ctx ? '\n' + ctx : ''}` };
      case 'telegram':
        return { text: `${title}\n${p.message}${ctx ? '\n' + ctx : ''}` };
      default:
        return { title, message: p.message, severity: p.severity, context: p.context };
    }
  }

  private previewUrl(u: string): string {
    if (!u) return '';
    try {
      const url = new URL(u);
      return `${url.protocol}//${url.host}…${url.pathname.slice(-8)}`;
    } catch {
      return u.slice(0, 30) + '…';
    }
  }
}
