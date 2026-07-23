import { GANTT_END, GANTT_START } from "@/app/folio/_content/ganttTasks";

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatYmd(dt: Date): string {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseYmd(b).getTime() - parseYmd(a).getTime()) / DAY_MS);
}

/** Inclusive list of YYYY-MM-DD from start → end. */
export function eachDate(
  start: string = GANTT_START,
  end: string = GANTT_END
): string[] {
  const out: string[] = [];
  let cur = parseYmd(start);
  const endDt = parseYmd(end);
  while (cur.getTime() <= endDt.getTime()) {
    out.push(formatYmd(cur));
    cur = new Date(cur.getTime() + DAY_MS);
  }
  return out;
}

export function formatDayLabel(ymd: string): string {
  return parseYmd(ymd).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function formatMonthLabel(ymd: string): string {
  return parseYmd(ymd).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function dayOfMonth(ymd: string): number {
  return parseYmd(ymd).getUTCDate();
}

/** 0 = Sun … 6 = Sat (UTC). */
export function weekday(ymd: string): number {
  return parseYmd(ymd).getUTCDay();
}

export function isWeekend(ymd: string): boolean {
  const w = weekday(ymd);
  return w === 0 || w === 6;
}

export type MonthSpan = {
  label: string;
  startIndex: number;
  dayCount: number;
};

export function monthSpans(dates: string[]): MonthSpan[] {
  const spans: MonthSpan[] = [];
  for (let i = 0; i < dates.length; i++) {
    const label = formatMonthLabel(dates[i]);
    const last = spans[spans.length - 1];
    if (last && last.label === label) {
      last.dayCount += 1;
    } else {
      spans.push({ label, startIndex: i, dayCount: 1 });
    }
  }
  return spans;
}
