import * as crypto from 'crypto';

export interface OrderKeyInput {
  signalId: string;
  accountId: string;
  symbol: string;
  expiryMinutes: number;
}

export function buildOrderKey(input: OrderKeyInput): string {
  const { signalId, accountId, symbol, expiryMinutes } = input;
  
  const data = `${signalId}|${accountId}|${symbol}|${expiryMinutes}`;
  
  const hash = crypto.createHash('sha256');
  hash.update(data);
  
  return hash.digest('hex');
}
