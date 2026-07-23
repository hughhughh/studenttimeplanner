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

function mathsRevision(): Item {
  return {
    id: "maths-1",
    userId: "test-user",
    type: "task",
    title: "Maths revision",
    color: "#66AA3C",
    movable: true,
    tz: TZ,
    segments: [
      {
        start: dateTimeFrom("2026-07-22", "19:00", TZ).toISO() ?? "",
        end: dateTimeFrom("2026-07-22", "20:00", TZ).toISO() ?? "",
      },
    ],
    createdAt: stamp,
    updatedAt: stamp,
  };
}

describe("moveItem preserves duration", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(updateItem).mockReset();
    vi.mocked(listItems).mockResolvedValue([mathsRevision()]);
    vi.mocked(updateItem).mockResolvedValue(mathsRevision());
  });

  it("shifts both ends when only timeStart is provided (an hour later)", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Moved Maths revision an hour later.",
        operations: [
          {
            type: "moveItem",
            itemId: "maths-1",
            timeStart: "20:00",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    const [, , patch] = vi.mocked(updateItem).mock.calls[0];
    const segments = patch.segments as { start: string; end: string }[];
    const start = DateTime.fromISO(segments[0].start, { zone: TZ });
    const end = DateTime.fromISO(segments[0].end, { zone: TZ });
    expect(start.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-07-22 20:00");
    expect(end.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-07-22 21:00");
    expect(end.diff(start, "minutes").minutes).toBe(60);
  });

  it("shifts both ends via minutes on moveItem", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Moved Maths revision an hour later.",
        operations: [
          {
            type: "moveItem",
            itemId: "maths-1",
            minutes: 60,
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    const [, , patch] = vi.mocked(updateItem).mock.calls[0];
    const segments = patch.segments as { start: string; end: string }[];
    const start = DateTime.fromISO(segments[0].start, { zone: TZ });
    const end = DateTime.fromISO(segments[0].end, { zone: TZ });
    expect(start.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-07-22 20:00");
    expect(end.toFormat("yyyy-MM-dd HH:mm")).toBe("2026-07-22 21:00");
  });

  it("updateItem with only timeStart keeps the existing end (resizes)", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Maths revision now starts at 19:30.",
        operations: [
          {
            type: "updateItem",
            itemId: "maths-1",
            timeStart: "19:30",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    const [, , patch] = vi.mocked(updateItem).mock.calls[0];
    const segments = patch.segments as { start: string; end: string }[];
    const start = DateTime.fromISO(segments[0].start, { zone: TZ });
    const end = DateTime.fromISO(segments[0].end, { zone: TZ });
    expect(start.toFormat("HH:mm")).toBe("19:30");
    expect(end.toFormat("HH:mm")).toBe("20:00");
  });

  it("rejects updateItem when new start is not before existing end", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        operations: [
          {
            type: "updateItem",
            itemId: "maths-1",
            timeStart: "20:00",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/after start/i);
  });
});
