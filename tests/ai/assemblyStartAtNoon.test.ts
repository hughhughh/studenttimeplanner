import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Item } from "@/lib/types";
import { normalizeTimeOfDay } from "@/lib/calendar/time";

vi.mock("@/lib/db/items", () => ({
  listItems: vi.fn(),
  createManyItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

import { listItems, updateItem } from "@/lib/db/items";
import { applyAiResponse } from "@/lib/ai/apply";

const TZ = "Australia/Sydney";
const stamp = "2026-07-01T00:00:00.000+10:00";

function assemblySeries(): Item {
  return {
    id: "assembly-1",
    userId: "test-user",
    type: "activity",
    title: "Assembly",
    color: "#64748B",
    movable: false,
    tz: TZ,
    recurrence: {
      freq: "weekly",
      byWeekday: [1, 2, 3, 4, 5],
      timeStart: "11:55",
      timeEnd: "12:15",
      startDate: "2026-07-01",
    },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

describe("normalizeTimeOfDay", () => {
  it("accepts common 12h and 24h forms", () => {
    expect(normalizeTimeOfDay("12pm")).toBe("12:00");
    expect(normalizeTimeOfDay("12:00 PM")).toBe("12:00");
    expect(normalizeTimeOfDay("12:00:00")).toBe("12:00");
    expect(normalizeTimeOfDay("11:55")).toBe("11:55");
    expect(normalizeTimeOfDay("noon")).toBeNull();
  });
});

describe("assembly start-at-12pm series update", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(updateItem).mockReset();
    vi.mocked(listItems).mockResolvedValue([assemblySeries()]);
    vi.mocked(updateItem).mockResolvedValue(assemblySeries());
  });

  it("normalizes 12pm and keeps the existing end on series updateItem", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Assemblies now start at 12:00.",
        operations: [
          {
            type: "updateItem",
            itemId: "assembly-1",
            scope: "series",
            timeStart: "12pm",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    const [, , patch] = vi.mocked(updateItem).mock.calls[0];
    const recurrence = patch.recurrence as {
      timeStart: string;
      timeEnd: string;
    };
    expect(recurrence.timeStart).toBe("12:00");
    expect(recurrence.timeEnd).toBe("12:15");
  });

  it("rejects a bare Invalid DateTime-style end instead of writing it", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        operations: [
          {
            type: "updateItem",
            itemId: "assembly-1",
            scope: "series",
            timeStart: "12:00",
            timeEnd: "not-a-time",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/valid time/i);
    expect(updateItem).not.toHaveBeenCalled();
  });
});
