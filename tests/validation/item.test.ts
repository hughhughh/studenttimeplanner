import { describe, expect, it } from "vitest";
import { itemCreateSchema } from "@/lib/validation/item";
import { at, TZ } from "@/tests/fixtures/items";

describe("itemCreateSchema", () => {
  it("accepts a valid single-segment task", () => {
    const result = itemCreateSchema.safeParse({
      type: "task",
      title: "Study English",
      color: "#66AA3C",
      movable: true,
      tz: TZ,
      segments: [
        {
          start: at("2026-07-22", "19:00"),
          end: at("2026-07-22", "20:00"),
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid weekly activity", () => {
    const result = itemCreateSchema.safeParse({
      type: "activity",
      title: "School",
      color: "#3B82F6",
      movable: false,
      tz: TZ,
      recurrence: {
        freq: "weekly",
        byWeekday: [1, 2, 3, 4, 5],
        timeStart: "08:30",
        timeEnd: "15:00",
        startDate: "2026-07-01",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects items with both segments and recurrence", () => {
    const result = itemCreateSchema.safeParse({
      type: "task",
      title: "Bad",
      color: "#66AA3C",
      movable: true,
      tz: TZ,
      segments: [
        {
          start: at("2026-07-22", "19:00"),
          end: at("2026-07-22", "20:00"),
        },
      ],
      recurrence: {
        freq: "weekly",
        byWeekday: [1],
        timeStart: "09:00",
        timeEnd: "10:00",
        startDate: "2026-07-01",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects completing an activity", () => {
    const result = itemCreateSchema.safeParse({
      type: "activity",
      title: "Sport",
      color: "#3B82F6",
      movable: false,
      tz: TZ,
      completed: true,
      segments: [
        {
          start: at("2026-07-22", "16:00"),
          end: at("2026-07-22", "17:00"),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid hex colours", () => {
    const result = itemCreateSchema.safeParse({
      type: "task",
      title: "X",
      color: "green",
      movable: true,
      tz: TZ,
      segments: [
        {
          start: at("2026-07-22", "19:00"),
          end: at("2026-07-22", "20:00"),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const result = itemCreateSchema.safeParse({
      type: "task",
      title: "",
      color: "#66AA3C",
      movable: true,
      tz: TZ,
      segments: [
        {
          start: at("2026-07-22", "19:00"),
          end: at("2026-07-22", "20:00"),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects segment end before start", () => {
    const result = itemCreateSchema.safeParse({
      type: "task",
      title: "X",
      color: "#66AA3C",
      movable: true,
      tz: TZ,
      segments: [
        {
          start: at("2026-07-22", "20:00"),
          end: at("2026-07-22", "19:00"),
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero-length segment (end equals start)", () => {
    const result = itemCreateSchema.safeParse({
      type: "task",
      title: "X",
      color: "#66AA3C",
      movable: true,
      tz: TZ,
      segments: [
        {
          start: at("2026-07-22", "19:00"),
          end: at("2026-07-22", "19:00"),
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
