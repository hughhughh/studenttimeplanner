import { describe, expect, it } from "vitest";
import {
  assignLanes,
  blockPosition,
  bodyHeight,
  MIN_BLOCK_PX,
} from "@/lib/calendar/grid";
import { at, TZ } from "@/tests/fixtures/items";

describe("grid layout", () => {
  it("computes body height from working hours", () => {
    // 6am–10pm = 16 hours × 60px
    expect(bodyHeight(6, 22)).toBe(16 * 60);
  });

  it("positions a 1-hour block at 9am within 6–22 window", () => {
    const start = at("2026-07-22", "09:00");
    const end = at("2026-07-22", "10:00");
    const { top, height } = blockPosition(start, end, TZ, 6, 22);
    // 9:00 is 3 hours after 6:00 → 180 minutes → top 180
    expect(top).toBe(180);
    expect(height).toBe(60);
  });

  it("enforces a minimum block height for very short events", () => {
    const start = at("2026-07-22", "12:00");
    const end = at("2026-07-22", "12:05");
    const { height } = blockPosition(start, end, TZ, 6, 22);
    expect(height).toBe(MIN_BLOCK_PX);
  });

  it("assigns overlapping intervals to different lanes", () => {
    const a = { start: "2026-07-22T10:00:00+10:00", end: "2026-07-22T11:00:00+10:00" };
    const b = { start: "2026-07-22T10:30:00+10:00", end: "2026-07-22T11:30:00+10:00" };
    const c = { start: "2026-07-22T11:00:00+10:00", end: "2026-07-22T12:00:00+10:00" };
    const placed = assignLanes([a, b, c]);
    expect(placed).toHaveLength(3);
    expect(placed[0].lane).toBe(0);
    expect(placed[1].lane).toBe(1);
    // c starts when a ends → can reuse lane 0
    expect(placed[2].lane).toBe(0);
    expect(placed[0].lanes).toBe(2);
  });
});
