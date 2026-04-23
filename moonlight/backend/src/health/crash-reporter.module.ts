/**
 * MoonLight v2.6-4 — Crash Telemetry Module.
 *
 * Local-first crash collection for the packaged desktop app. The
 * Electron main process forwards crash events (backend exits, renderer
 * crashes, main uncaught) to POST /api/crash/report. We:
 *
 *   1. Accept only localhost requests (loopback guard — same pattern
 *      as the secrets controller).
 *   2. Append each event to a bounded in-memory ring buffer (1k).
 *   3. Optionally persist to `<DATA_DIR>/crash-reports.jsonl`.
 *   4. Expose GET /api/crash/reports for the Owner Console UI.
 *
 * No remote upload happens from the backend itself. Operators that want
 * a remote sink set `MOONLIGHT_CRASH_UPLOAD_URL` on the *Electron* side.
 */

import {
  Body,
  Controller,
  Get,
  Injectable,
  Logger,
  Module,
  Post,
  Query,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import type { Request } from 'express';
import * as fs from 'fs';
import * as path from 'path';

export interface CrashReport {
  id: string;
  at: string;
  kind: string;
  message: string;
  context: Record<string, unknown>;
  source: 'desktop' | 'backend' | 'renderer';
  receivedAtUtc: string;
}

const MAX_REPORTS = 1000;

@Injectable()
export class CrashReporterService {
  private readonly logger = new Logger(CrashReporterService.name);
  private readonly reports: CrashReport[] = [];
  private readonly persistPath: string | null = null;

  constructor() {
    const dataDir = process.env.MOONLIGHT_DATA_DIR || path.join(process.cwd(), 'data');
    try {
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      this.persistPath = path.join(dataDir, 'crash-reports.jsonl');
      // Warm-load last reports (best effort).
      if (fs.existsSync(this.persistPath)) {
        const lines = fs
          .readFileSync(this.persistPath, 'utf8')
          .split('\n')
          .filter((l) => l.trim());
        const recent = lines.slice(-MAX_REPORTS);
        for (const l of recent) {
          try {
            this.reports.push(JSON.parse(l));
          } catch {
            /* skip malformed */
          }
        }
        this.logger.log(
          `CrashReporter warm-loaded ${this.reports.length} prior events`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `crash reporter persist init failed: ${(err as Error).message}`,
      );
    }
  }

  record(partial: Omit<CrashReport, 'receivedAtUtc'>): CrashReport {
    const full: CrashReport = {
      ...partial,
      receivedAtUtc: new Date().toISOString(),
    };
    this.reports.push(full);
    if (this.reports.length > MAX_REPORTS) {
      this.reports.splice(0, this.reports.length - MAX_REPORTS);
    }
    if (this.persistPath) {
      try {
        fs.appendFileSync(this.persistPath, JSON.stringify(full) + '\n', {
          mode: 0o600,
        });
      } catch {
        /* ignore — best effort */
      }
    }
    this.logger.warn(
      `crash received: kind=${full.kind} source=${full.source} msg=${full.message}`,
    );
    return full;
  }

  list(limit = 50, sourceFilter?: string): CrashReport[] {
    const filtered = sourceFilter
      ? this.reports.filter((r) => r.source === sourceFilter)
      : this.reports;
    return filtered.slice(-limit).reverse();
  }

  stats(): {
    total: number;
    byKind: Record<string, number>;
    bySource: Record<string, number>;
    latestAt: string | null;
  } {
    const byKind: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    for (const r of this.reports) {
      byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
      bySource[r.source] = (bySource[r.source] ?? 0) + 1;
    }
    return {
      total: this.reports.length,
      byKind,
      bySource,
      latestAt: this.reports.length
        ? this.reports[this.reports.length - 1].receivedAtUtc
        : null,
    };
  }
}

function assertLoopback(req: Request): void {
  const ip = req.ip ?? req.socket?.remoteAddress ?? '';
  const ok =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.startsWith('127.') ||
    ip.startsWith('::ffff:127.');
  if (!ok) {
    throw new ForbiddenException(
      `crash reporter is localhost-only (seen=${ip})`,
    );
  }
}

interface IncomingCrashBody {
  id?: string;
  at?: string;
  kind?: string;
  message?: string;
  context?: Record<string, unknown>;
  source?: 'desktop' | 'backend' | 'renderer';
}

@Controller('crash')
export class CrashReporterController {
  constructor(private readonly svc: CrashReporterService) {}

  @Post('report')
  report(@Req() req: Request, @Body() body: IncomingCrashBody): CrashReport {
    assertLoopback(req);
    const rec = this.svc.record({
      id:
        body.id ??
        `backend-crash-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: body.at ?? new Date().toISOString(),
      kind: body.kind ?? 'unknown',
      message: body.message ?? '(no message)',
      context: body.context ?? {},
      source: body.source ?? 'desktop',
    });
    return rec;
  }

  @Get('reports')
  list(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('source') source?: string,
  ): CrashReport[] {
    assertLoopback(req);
    const n = Math.min(500, Math.max(1, Number.parseInt(limit ?? '50', 10) || 50));
    return this.svc.list(n, source);
  }

  @Get('stats')
  stats(@Req() req: Request): ReturnType<CrashReporterService['stats']> {
    assertLoopback(req);
    return this.svc.stats();
  }
}

@Module({
  controllers: [CrashReporterController],
  providers: [CrashReporterService],
  exports: [CrashReporterService],
})
export class CrashReporterModule {}
