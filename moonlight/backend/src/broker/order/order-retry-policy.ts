export function getRetryDelaysMs(maxAttempts: number): number[] {
  if (maxAttempts <= 0) {
    return [];
  }

  const delays: number[] = [];
  let baseDelay = 200;

  for (let i = 0; i < maxAttempts; i++) {
    delays.push(baseDelay);
    baseDelay *= 2;
  }

  return delays;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
