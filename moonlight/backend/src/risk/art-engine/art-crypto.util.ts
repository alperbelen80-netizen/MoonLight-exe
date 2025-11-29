import * as crypto from 'crypto';
import { AtomicRiskTokenDTO } from '../../shared/dto/atomic-risk-token.dto';

export function signART(
  artPayload: Omit<AtomicRiskTokenDTO, 'signature'>,
): string {
  const secret = process.env.ART_SIGNING_SECRET || 'default_dev_secret_change_me';
  
  if (secret === 'default_dev_secret_change_me' && process.env.NODE_ENV === 'production') {
    throw new Error('ART_SIGNING_SECRET not set in production environment');
  }

  const dataToSign = JSON.stringify({
    art_id: artPayload.art_id,
    signal_id: artPayload.signal_id,
    decision: artPayload.decision,
    approved_stake: artPayload.approved_stake,
    created_at: artPayload.created_at,
    expires_at: artPayload.expires_at,
  });

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(dataToSign);
  const signature = hmac.digest('hex');

  return signature;
}

export function verifyARTSignature(
  art: AtomicRiskTokenDTO,
): boolean {
  const expectedSignature = signART(art);
  return art.signature === expectedSignature;
}
