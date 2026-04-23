// MoonLight V2.6-2 — Secrets REST API
//
// Localhost-only REST surface for vault management. Every request is
// validated against a strict allow-list of loopback IPs; anything else
// is 403'd regardless of the Origin header.
//
// Response shapes NEVER contain secret values. Callers that need values
// go through server-side consumers (BrokerCredentialsService) which read
// the vault internally.

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Put,
  Req,
} from '@nestjs/common';
import { SecretsStoreService, SecretMetadata, SecretsAuditEvent } from './secrets-store.service';

interface PutBody {
  value: string;
}

function isLoopback(ip: string | undefined): boolean {
  if (!ip) return false;
  // IPv4 loopback + IPv6 localhost + IPv4-mapped IPv6 loopback.
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('127.') // covers 127.x.x.x range
  );
}

function extractActor(headers: Record<string, string | string[] | undefined>): string {
  const hdr = headers['x-moonlight-actor'];
  if (Array.isArray(hdr)) return hdr[0] ?? 'unknown';
  return typeof hdr === 'string' ? hdr : 'localhost';
}

@Controller('secrets')
export class SecretsController {
  constructor(private readonly store: SecretsStoreService) {}

  private assertLoopback(req: { ip?: string; socket?: { remoteAddress?: string } }): void {
    const ip = req.ip || req.socket?.remoteAddress || '';
    if (!isLoopback(ip)) {
      throw new ForbiddenException(
        `secrets API is localhost-only; remote=${ip || 'unknown'}`,
      );
    }
  }

  @Get('health')
  health(@Req() req: any): {
    backend: 'keytar' | 'file';
    hardened: boolean;
  } {
    this.assertLoopback(req);
    return {
      backend: this.store.backendName(),
      hardened: this.store.isHardened(),
    };
  }

  @Get()
  async list(@Req() req: any, @Headers() headers: any): Promise<{
    items: SecretMetadata[];
  }> {
    this.assertLoopback(req);
    const items = await this.store.list(extractActor(headers));
    return { items };
  }

  @Get(':key/exists')
  async has(
    @Req() req: any,
    @Headers() headers: any,
    @Param('key') key: string,
  ): Promise<{ key: string; present: boolean }> {
    this.assertLoopback(req);
    const present = await this.store.has(key, extractActor(headers));
    return { key, present };
  }

  @Put(':key')
  async set(
    @Req() req: any,
    @Headers() headers: any,
    @Param('key') key: string,
    @Body() body: PutBody,
  ): Promise<{ ok: true; metadata: SecretMetadata }> {
    this.assertLoopback(req);
    if (!body || typeof body.value !== 'string') {
      throw new BadRequestException('{ "value": string } required');
    }
    const metadata = await this.store.set(key, body.value, extractActor(headers));
    return { ok: true, metadata };
  }

  @Delete(':key')
  async delete(
    @Req() req: any,
    @Headers() headers: any,
    @Param('key') key: string,
  ): Promise<{ ok: true; deleted: boolean }> {
    this.assertLoopback(req);
    const deleted = await this.store.delete(key, extractActor(headers));
    return { ok: true, deleted };
  }

  @Get('audit/trail')
  audit(@Req() req: any): { events: SecretsAuditEvent[] } {
    this.assertLoopback(req);
    return { events: this.store.getAuditTrail(100) };
  }
}
