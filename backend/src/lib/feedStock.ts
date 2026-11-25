/**
 * Server copy of frontend-react/src/lib/feeds.js computeFeedStock(), status
 * part only. Keep the two in step: same stock-line key, same low/out rules.
 */

const FEED_BAG_KG = 25;

export type StockStatus = "ok" | "low" | "out";

export interface StockLine {
  key: string;
  label: string;
  left: number;
  daysLeft: number | null;
  status: StockStatus;
}

const norm = (s: unknown) => String(s ?? "").trim().toLowerCase();

export function stockKey(e: { feedType?: unknown; brand?: unknown; bagSizeKg?: unknown }): string {
  return `${norm(e.feedType)}|${norm(e.brand)}|${Number(e.bagSizeKg) || FEED_BAG_KG}`;
}

function usageBags(log: Record<string, any>): number {
  if (log.bags != null) return Number(log.bags) || 0;
  return (Number(log.amountKg) || 0) / (Number(log.bagSizeKg) || FEED_BAG_KG);
}

export function computeFeedStock(
  purchases: Record<string, any>[],
  usage: Record<string, any>[],
  today: string
): StockLine[] {
  const weekAgo = new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10);
  const lines = new Map<string, { label: string; bought: number; used: number; usedLastWeek: number }>();

  for (const p of purchases) {
    const key = stockKey(p);
    if (!lines.has(key)) {
      lines.set(key, {
        label: [p.feedType, p.brand].filter(Boolean).join(" · "),
        bought: 0,
        used: 0,
        usedLastWeek: 0,
      });
    }
    lines.get(key)!.bought += Number(p.bags) || 0;
  }

  // Usage with no matching purchase stays out of the maths, as in the app.
  for (const u of usage) {
    const line = lines.get(stockKey(u));
    if (!line) continue;
    const bags = usageBags(u);
    line.used += bags;
    if (u.date && u.date > weekAgo && u.date <= today) line.usedLastWeek += bags;
  }

  return [...lines.entries()].map(([key, line]) => {
    const left = Math.round((line.bought - line.used) * 100) / 100;
    const perDay = line.usedLastWeek / 7;
    const daysLeft = perDay > 0 ? Math.floor(Math.max(left, 0) / perDay) : null;
    const status: StockStatus =
      left <= 0 ? "out" : (daysLeft != null && daysLeft <= 7) || left <= 2 ? "low" : "ok";
    return { key, label: line.label, left, daysLeft, status };
  });
}
