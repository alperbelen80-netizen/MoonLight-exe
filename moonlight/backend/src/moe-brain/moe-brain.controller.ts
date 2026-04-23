import { Body, Controller, HttpException, HttpStatus, Param, Post, Get } from '@nestjs/common';
import { CEOBrainService } from './brains/ceo-brain.service';
import { TRADEBrainService } from './brains/trade-brain.service';
import { TESTBrainService } from './brains/test-brain.service';
import { BrainType } from './shared/moe.enums';
import { MoEContext } from './shared/moe-context';
import { Eye2DecisionAuditorService } from '../trinity-oversight/eye2-decision-auditor.service';

@Controller('moe/brain')
export class MoeBrainController {
  constructor(
    private readonly ceo: CEOBrainService,
    private readonly trade: TRADEBrainService,
    private readonly test: TESTBrainService,
    private readonly auditor: Eye2DecisionAuditorService,
  ) {}

  @Get('roster')
  roster() {
    return {
      CEO: ['TREND', 'MEAN_REVERSION', 'VOLATILITY', 'NEWS', 'MACRO'],
      TRADE: ['ENTRY', 'EXIT', 'SLIPPAGE', 'PAYOUT', 'SESSION'],
      TEST: [
        'OVERFIT_HUNTER',
        'DATA_LEAK_DETECTOR',
        'BIAS_AUDITOR',
        'ADVERSARIAL_ATTACKER',
        'ROBUSTNESS_TESTER',
      ],
    };
  }

  @Post(':type/evaluate')
  async evaluate(@Param('type') type: string, @Body() body: MoEContext) {
    const upper = (type || '').toUpperCase();
    if (!body || typeof body !== 'object') {
      throw new HttpException('body_required', HttpStatus.BAD_REQUEST);
    }
    if (!body.symbol || !body.timeframe || !body.direction) {
      throw new HttpException(
        'symbol, timeframe, direction are required',
        HttpStatus.BAD_REQUEST,
      );
    }
    let result;
    switch (upper) {
      case BrainType.CEO:
        result = await this.ceo.evaluate(body);
        break;
      case BrainType.TRADE:
        result = await this.trade.evaluate(body);
        break;
      case BrainType.TEST:
        result = await this.test.evaluate(body);
        break;
      default:
        throw new HttpException(
          `Unknown brain type: ${type} (expected CEO|TRADE|TEST)`,
          HttpStatus.BAD_REQUEST,
        );
    }
    // Audit trail (in-memory ring buffer).
    const codes = result.experts.flatMap((e) => e.reasonCodes || []);
    this.auditor.record(body.signalId || `${body.symbol}-${Date.now()}`, codes);
    return result;
  }
}
