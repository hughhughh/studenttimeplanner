import { describe, expect, it } from "vitest";
import { expandItem } from "@/lib/calendar/recurrence";
import {
  NOW,
  WEEK_DATES,
  completedPastTask,
  overdueHomework,
  schoolWeekdays,
  upcomingTask,
} from "@/tests/fixtures/items";

describe("occurrence status", () => {
  it("marks incomplete past tasks as overdue", () => {
    const [occ] = expandItem(overdueHomework, WEEK_DATES, NOW);
    expect(occ.status).toBe("overdue");
    expect(occ.completed).toBe(false);
    expect(occ.completable).toBe(true);
  });

  it("marks completed past tasks as done (not overdue)", () => {
    const [occ] = expandItem(completedPastTask, WEEK_DATES, NOW);
    expect(occ.status).toBe("done");
    expect(occ.completed).toBe(true);
  });

  it("marks future incomplete tasks as upcoming", () => {
    const [occ] = expandItem(upcomingTask, WEEK_DATES, NOW);
    expect(occ.status).toBe("upcoming");
  });

  it("never marks activities overdue or completable", () => {
    const occ = expandItem(schoolWeekdays, WEEK_DATES, NOW);
    // Includes Monday/Tuesday which are fully in the past relative to Wed noon
    expect(occ.every((o) => o.status === "upcoming")).toBe(true);
    expect(occ.every((o) => o.completable === false)).toBe(true);
  });
});
