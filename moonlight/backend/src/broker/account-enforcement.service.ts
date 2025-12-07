import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OwnerAccount } from '../database/entities/owner-account.entity';

export type AccountType = 'REAL' | 'DEMO' | 'SIM_INTERNAL' | 'READ_ONLY';

export interface AccountValidationResult {
  allowed: boolean;
  accountType: AccountType;
  warnings: string[];
  requiresConfirmation: boolean;
}

@Injectable()
export class AccountEnforcementService {
  private readonly logger = new Logger(AccountEnforcementService.name);

  constructor(
    @InjectRepository(OwnerAccount)
    private readonly accountRepo: Repository<OwnerAccount>,
  ) {}

  async validateAccountForExecution(
    accountId: string,
  ): Promise<AccountValidationResult> {
    const account = await this.accountRepo.findOne({
      where: { account_id: accountId },
    });

    if (!account) {
      throw new ForbiddenException('Account not found');
    }

    const accountType = account.type as AccountType;
    const warnings: string[] = [];
    let allowed = true;
    let requiresConfirmation = false;

    switch (accountType) {
      case 'REAL':
        requiresConfirmation = true;
        warnings.push('REAL ACCOUNT: Gerçek para kullanılacak!');
        warnings.push('DayCap ve risk limitlerini kontrol edin');
        break;

      case 'DEMO':
        if (process.env.DEMO_AUTO_EXECUTION_ALLOWED !== 'true') {
          allowed = false;
          warnings.push('DEMO hesaplarda otomatik execution kapalı');
          warnings.push('Manuel işlem yapabilirsiniz');
        } else {
          warnings.push('DEMO ACCOUNT: Sanal para kullanılıyor');
        }
        break;

      case 'SIM_INTERNAL':
        warnings.push('SIMULATION: Internal test hesabı');
        break;

      case 'READ_ONLY':
        allowed = false;
        warnings.push('READ-ONLY hesapta işlem yapılamaz');
        break;

      default:
        allowed = false;
        warnings.push('Bilinmeyen hesap tipi');
    }

    if (account.status !== 'ACTIVE') {
      allowed = false;
      warnings.push(`Hesap durumu: ${account.status} (ACTIVE değil)`);
    }

    if (account.session_health === 'DOWN' || account.session_health === 'COOLDOWN') {
      allowed = false;
      warnings.push(`Session health: ${account.session_health}`);
    }

    this.logger.log(
      `Account validation: ${accountId} (${accountType}) - Allowed: ${allowed}, Warnings: ${warnings.length}`,
    );

    return {
      allowed,
      accountType,
      warnings,
      requiresConfirmation,
    };
  }

  async logAccountAction(
    accountId: string,
    action: string,
    details?: string,
  ): Promise<void> {
    this.logger.log(
      `ACCOUNT ACTION: ${accountId} - ${action} ${details ? `(${details})` : ''}`,
    );
  }
}
