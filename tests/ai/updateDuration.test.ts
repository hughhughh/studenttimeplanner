import { describe, expect, it, vi, beforeEach } from "vitest";
import { DateTime } from "luxon";
import type { Item } from "@/lib/types";
import { dateTimeFrom } from "@/lib/calendar/time";

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

function essayAug1(): Item {
  return {
    id: "essay-1",
    userId: "test-user",
    type: "task",
    title: "Essay",
    color: "#66AA3C",
    movable: true,
    tz: TZ,
    segments: [
      {
        start: dateTimeFrom("2026-08-01", "16:00", TZ).toISO() ?? "",
        end: dateTimeFrom("2026-08-01", "17:00", TZ).toISO() ?? "",
      },
    ],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

describe("updateItem duration", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(updateItem).mockReset();
    vi.mocked(listItems).mockResolvedValue([essayAug1()]);
    vi.mocked(updateItem).mockResolvedValue(essayAug1());
  });

  it("resizes an item on a given date to 4 hours via minutes", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Made Essay 4 hours on 1 August.",
        operations: [
          {
            type: "updateItem",
            itemId: "essay-1",
            date: "2026-08-01",
            minutes: 240,
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    expect(updateItem).toHaveBeenCalledTimes(1);
    const [, , patch] = vi.mocked(updateItem).mock.calls[0];
    const segments = patch.segments as { start: string; end: string }[];
    expect(segments).toHaveLength(1);
    const start = DateTime.fromISO(segments[0].start, { zone: TZ });
    const end = DateTime.fromISO(segments[0].end, { zone: TZ });
    expect(start.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-08-01 16:00");
    expect(end.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-08-01 20:00");
    expect(end.diff(start, "hours").hours).toBe(4);
  });

  it("still rejects empty updateItem metadata-only with no fields", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        operations: [{ type: "updateItem", itemId: "essay-1" }],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Nothing to update/i);
    expect(updateItem).not.toHaveBeenCalled();
  });
});
