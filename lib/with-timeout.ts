/**
 * Race `promise` against a timer. On timeout, resolves with `{ timedOut: true }`
 * (the underlying promise keeps running but no longer blocks the response).
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<{ timedOut: false; value: T } | { timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutP = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  try {
    return await Promise.race([
      promise.then((value) => ({ timedOut: false as const, value })),
      timeoutP
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function authCallTimeoutMs(): number {
  const raw = process.env.RUNFOLIO_AUTH_TIMEOUT_MS?.trim();
  if (raw) {
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 500 && n <= 120_000) return n;
  }
  return 3000;
}
