import { Body, Controller, Get, Post } from '@nestjs/common';
import { DataFeedOrchestrator, DataFeedProvider } from './sources/data-feed-orchestrator.service';
import { AICoachService } from '../ai-coach/ai-coach.service';

@Controller('data/providers')
export class DataProvidersController {
  constructor(
    private readonly orchestrator: DataFeedOrchestrator,
    private readonly coach: AICoachService,
  ) {}

  @Get('health')
  async health() {
    const { health, deterministicChoice, active } = await this.orchestrator.probeAndScore();
    return {
      active,
      deterministicChoice,
      providers: health,
      generated_at_utc: new Date().toISOString(),
    };
  }

  @Post('auto-select')
  async autoSelect(@Body() body: { requireAIValidation?: boolean; apply?: boolean } = {}) {
    const requireAI = body?.requireAIValidation !== false; // default ON (fail-closed)
    const apply = body?.apply !== false; // default ON

    const { health, deterministicChoice, active } = await this.orchestrator.probeAndScore();

    let aiResult: any = null;
    let switchedTo: DataFeedProvider | null = null;
    let reason = '';

    if (requireAI && this.coach && this.coach.isAvailable()) {
      aiResult = await this.coach.validateFeedSelection({
        providers: health.map((p) => ({
          name: p.name,
          connected: p.connected,
          latencyMs: p.latencyMs,
          lastError: p.lastError,
          score: p.score,
        })),
        deterministicChoice,
      });

      if (!apply) {
        reason = `Dry-run: AI ${aiResult.approved ? 'approved' : 'did not approve'} (conf=${aiResult.confidence.toFixed(2)})`;
      } else if (aiResult.approved && aiResult.confidence >= 0.6) {
        const target = (aiResult.chosenProvider as DataFeedProvider) || deterministicChoice;
        if (target !== active) {
          await this.orchestrator.switchProvider(target);
          switchedTo = target;
          reason = `AI-approved (conf=${aiResult.confidence.toFixed(2)}): ${aiResult.reason}`;
        } else {
          reason = 'AI-approved but already active; no switch';
        }
      } else {
        reason = `Fail-closed: AI did not approve (approved=${aiResult?.approved}, conf=${aiResult?.confidence})`;
      }
    } else if (apply) {
      // Deterministic-only mode: switch if the chosen provider is healthier than active.
      const activeHealth = health.find((p) => p.name === active);
      const targetHealth = health.find((p) => p.name === deterministicChoice);
      const activeScore = activeHealth?.score ?? -99;
      const targetScore = targetHealth?.score ?? -99;

      if (deterministicChoice !== active && targetScore > activeScore + 5) {
        await this.orchestrator.switchProvider(deterministicChoice);
        switchedTo = deterministicChoice;
        reason = `Deterministic switch (score ${activeScore.toFixed(1)} → ${targetScore.toFixed(1)})`;
      } else {
        reason = 'No switch: active provider is within tolerance';
      }
    } else {
      reason = 'Dry-run: apply=false';
    }

    return {
      active: this.orchestrator.getActiveProviderName(),
      previous: active,
      switchedTo,
      deterministicChoice,
      aiValidation: aiResult,
      reason,
      health,
      ai_available: this.coach?.isAvailable() ?? false,
    };
  }

  @Post('switch')
  async manualSwitch(@Body() body: { provider: DataFeedProvider }) {
    if (!body?.provider) throw new Error('provider is required');
    await this.orchestrator.switchProvider(body.provider);
    return { active: this.orchestrator.getActiveProviderName() };
  }
}
