import { Injectable, Logger } from '@nestjs/common';
import { SessionHealth } from '../../shared/enums/session-health.enum';

interface SessionState {
  health: SessionHealth;
  lastCheckedAtUtc: Date;
  cooldownUntil?: Date;
}

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);
  
  private sessions: Map<string, SessionState> = new Map();

  async ensureSession(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId);

    if (!session) {
      this.sessions.set(accountId, {
        health: SessionHealth.UP,
        lastCheckedAtUtc: new Date(),
      });
      this.logger.log(`Session initialized for ${accountId}`);
    }
  }

  async markDegraded(accountId: string): Promise<void> {
    const session = this.sessions.get(accountId);
    if (session) {
      session.health = SessionHealth.DEGRADED;
      session.lastCheckedAtUtc = new Date();
      this.logger.warn(`Session ${accountId} marked DEGRADED`);
    }
  }

  async markCooldown(accountId: string, untilUtc: string): Promise<void> {
    const session = this.sessions.get(accountId);
    if (session) {
      session.health = SessionHealth.COOLDOWN;
      session.cooldownUntil = new Date(untilUtc);
      session.lastCheckedAtUtc = new Date();
      this.logger.warn(`Session ${accountId} in COOLDOWN until ${untilUtc}`);
    }
  }

  getSessionHealth(accountId: string): SessionHealth {
    const session = this.sessions.get(accountId);

    if (!session) {
      return SessionHealth.DOWN;
    }

    if (session.health === SessionHealth.COOLDOWN && session.cooldownUntil) {
      if (new Date() > session.cooldownUntil) {
        session.health = SessionHealth.UP;
        this.logger.log(`Session ${accountId} cooldown expired, back to UP`);
      }
    }

    return session.health;
  }

  getAllSessions(): Map<string, SessionState> {
    return new Map(this.sessions);
  }

  clearSessions(): void {
    this.sessions.clear();
  }
}
