import { describe, expect, it } from "vitest";
import { eachDate, daysBetween } from "@/lib/gantt/dates";

describe("eachDate", () => {
  it("covers the folio window inclusively", () => {
    const dates = eachDate("2026-02-26", "2026-07-24");
    expect(dates[0]).toBe("2026-02-26");
    expect(dates[dates.length - 1]).toBe("2026-07-24");
    expect(dates.length).toBe(daysBetween("2026-02-26", "2026-07-24") + 1);
  });
});
