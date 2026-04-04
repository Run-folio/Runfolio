import "server-only";

import { createHash } from "node:crypto";
import type { FileFormat, FileParseResult } from "@/lib/activity-file-import/types";
import { parseGpxBuffer } from "@/lib/activity-file-import/parse-gpx";
import { parseTcxBuffer } from "@/lib/activity-file-import/parse-tcx";
import { parseFitBuffer } from "@/lib/activity-file-import/parse-fit";

export type { FileParseResult, NormalizedFileActivity } from "@/lib/activity-file-import/types";

export function inferFormatFromFilename(name: string): FileFormat | null {
  const n = name.trim().toLowerCase();
  if (n.endsWith(".gpx")) return "gpx";
  if (n.endsWith(".tcx")) return "tcx";
  if (n.endsWith(".fit")) return "fit";
  return null;
}

export function sha256Hex(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

export async function parseActivityFileBuffer(buf: Buffer, filename: string): Promise<FileParseResult> {
  const fmt = inferFormatFromFilename(filename);
  if (!fmt) {
    return {
      ok: false,
      code: "unsupported",
      message: "Unsupported format. Use .gpx, .tcx, or .fit."
    };
  }
  if (fmt === "gpx") return parseGpxBuffer(buf);
  if (fmt === "tcx") return parseTcxBuffer(buf);
  return parseFitBuffer(buf);
}
