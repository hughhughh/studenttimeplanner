import { describe, expect, it } from "vitest";
import {
  cycleDayToWeekdayAndCycle,
  recurrenceFromCycle,
} from "@/lib/calendar/cycle";

describe("timetable cycle helpers", () => {
  it("maps cycle days 1–10 to weekday and A/B", () => {
    expect(cycleDayToWeekdayAndCycle(1)).toEqual({
      weekday: 1,
      cycleWeek: "A",
    });
    expect(cycleDayToWeekdayAndCycle(5)).toEqual({
      weekday: 5,
      cycleWeek: "A",
    });
    expect(cycleDayToWeekdayAndCycle(6)).toEqual({
      weekday: 1,
      cycleWeek: "B",
    });
    expect(cycleDayToWeekdayAndCycle(10)).toEqual({
      weekday: 5,
      cycleWeek: "B",
    });
  });

  it("rejects invalid cycle days", () => {
    expect(() => cycleDayToWeekdayAndCycle(0)).toThrow();
    expect(() => cycleDayToWeekdayAndCycle(11)).toThrow();
  });

  it("builds fortnightly recurrence anchored to Week A/B", () => {
    const rec = recurrenceFromCycle({
      cycleWeek: "A",
      weekday: 2,
      timeStart: "09:00",
      timeEnd: "10:00",
      anchorMonday: "2026-07-20",
      currentCycleWeek: "A",
    });
    expect(rec.freq).toBe("weekly");
    expect(rec.interval).toBe(2);
    expect(rec.byWeekday).toEqual([2]);
    expect(rec.startDate).toBe("2026-07-20");
    expect(rec.timeStart).toBe("09:00");
  });
});
