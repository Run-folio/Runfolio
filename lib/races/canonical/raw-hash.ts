import { createHash } from "node:crypto";

export function hashRawPayload(payload: Record<string, unknown> | null | undefined): string {
  const stable = payload == null ? "" : JSON.stringify(payload, Object.keys(payload).sort());
  return createHash("sha256").update(stable).digest("hex");
}
