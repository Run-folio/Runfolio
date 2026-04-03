/**
 * Build a recurring calendar `start_date` per edition year so canonical date-window matching can see UTMB rows.
 * When `edition_date_anchor_ymd` is set, its month/day are applied to each target year.
 * Otherwise uses the first typical month and a stable day derived from the series id (spreads collisions).
 */
export function editionStartDateYmd(
  year: number,
  row: { id: string; typical_months?: number[]; edition_date_anchor_ymd?: string }
): string | null {
  if (!Number.isFinite(year) || year < 1970 || year > 2100) return null;

  const anchor = row.edition_date_anchor_ymd?.trim();
  if (anchor && anchor.length >= 10) {
    const tail = anchor.slice(5, 10);
    const m = tail.match(/^(\d{2})-(\d{2})$/);
    if (m) {
      const mm = m[1]!;
      const dd = m[2]!;
      const ymd = `${year}-${mm}-${dd}`;
      const d = new Date(`${ymd}T12:00:00Z`);
      if (!Number.isNaN(d.getTime())) return ymd;
    }
  }

  const months = row.typical_months?.filter((m) => m >= 1 && m <= 12) ?? [8];
  const month = months[0]!;
  let h = 0;
  for (let i = 0; i < row.id.length; i++) h = (h * 31 + row.id.charCodeAt(i)) >>> 0;
  const day = 12 + (h % 15);
  const ymd = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const d = new Date(`${ymd}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  return ymd;
}

export function defaultEditionYearRange(referenceYear: number): { from: number; to: number } {
  return { from: referenceYear - 1, to: referenceYear + 2 };
}
