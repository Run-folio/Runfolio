/** Server and edge safe — use for Vercel / local log correlation. */

function formatErr(err: unknown): string {
  if (err instanceof Error) {
    return `${err.name}: ${err.message}${err.stack ? `\n${err.stack}` : ""}`;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export type RunfolioLogMeta = Record<string, string | number | boolean | undefined | null>;

export const runfolioLog = {
  error(scope: string, err: unknown, meta?: RunfolioLogMeta) {
    const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    console.error(`[Runfolio:error][${scope}]${suffix}`, formatErr(err));
  },

  warn(scope: string, message: string, meta?: RunfolioLogMeta) {
    const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    console.warn(`[Runfolio:warn][${scope}] ${message}${suffix}`);
  },

  info(scope: string, message: string, meta?: RunfolioLogMeta) {
    const suffix = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
    console.info(`[Runfolio:info][${scope}] ${message}${suffix}`);
  }
};
