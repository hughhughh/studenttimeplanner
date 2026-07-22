import { describe, expect, it } from "vitest";
import { expandItem, expandWeek } from "@/lib/calendar/recurrence";
import {
  NOW,
  WEEK_DATES,
  revisionWithOverride,
  schoolWeekdays,
  schoolWithWednesdayException,
  splitEssay,
  weekASport,
} from "@/tests/fixtures/items";

describe("expandWeek / expandItem — recurrence", () => {
  it("expands weekday school into five Mon–Fri occurrences", () => {
    const occ = expandItem(schoolWeekdays, WEEK_DATES, NOW);
    expect(occ).toHaveLength(5);
    expect(occ.map((o) => o.date)).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
    ]);
    expect(occ.every((o) => o.recurring)).toBe(true);
    expect(occ.every((o) => o.type === "activity")).toBe(true);
    expect(occ.every((o) => o.completable === false)).toBe(true);
  });

  it("omits an exception date without leaving an orphan", () => {
    const occ = expandItem(schoolWithWednesdayException, WEEK_DATES, NOW);
    expect(occ).toHaveLength(4);
    expect(occ.map((o) => o.date)).not.toContain("2026-07-22");
    expect(occ.map((o) => o.date)).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-23",
      "2026-07-24",
    ]);
  });

  it("applies per-date title and time overrides", () => {
    const occ = expandItem(revisionWithOverride, WEEK_DATES, NOW);
    expect(occ).toHaveLength(1);
    expect(occ[0].date).toBe("2026-07-23");
    expect(occ[0].title).toBe("Exam revision (extended)");
    // 19:00–21:00 Sydney on that Thursday
    expect(occ[0].start).toContain("2026-07-23T19:00");
    expect(occ[0].end).toContain("2026-07-23T21:00");
  });

  it("expands split sessions as two occurrences sharing itemId", () => {
    const occ = expandItem(splitEssay, WEEK_DATES, NOW);
    expect(occ).toHaveLength(2);
    expect(occ.every((o) => o.itemId === "essay-1")).toBe(true);
    expect(occ.map((o) => o.key)).toEqual(["essay-1#0", "essay-1#1"]);
    expect(occ[0].segmentIndex).toBe(0);
    expect(occ[1].segmentIndex).toBe(1);
  });

  it("respects fortnightly interval for Week A sport", () => {
    const thisWeek = expandItem(weekASport, WEEK_DATES, NOW);
    expect(thisWeek).toHaveLength(1);
    expect(thisWeek[0].date).toBe("2026-07-20");

    const nextWeekDates = [
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ];
    const nextWeek = expandItem(weekASport, nextWeekDates, NOW);
    expect(nextWeek).toHaveLength(0);
  });

  it("expandWeek sorts all fixtures by start time", () => {
    const occ = expandWeek(
      [schoolWeekdays, splitEssay, revisionWithOverride],
      WEEK_DATES,
      NOW
    );
    const starts = occ.map((o) => o.start);
    expect(starts).toEqual([...starts].sort((a, b) => a.localeCompare(b)));
  });
});
