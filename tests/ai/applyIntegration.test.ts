import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types";
import { dateTimeFrom } from "@/lib/calendar/time";

vi.mock("@/lib/db/items", () => ({
  listItems: vi.fn(),
  createManyItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

import {
  createManyItems,
  deleteItem,
  listItems,
  updateItem,
} from "@/lib/db/items";
import { applyAiResponse } from "@/lib/ai/apply";

const TZ = "Australia/Sydney";
const stamp = "2026-07-01T00:00:00.000+10:00";

function schoolWeekdays(): Item {
  return {
    id: "school-1",
    userId: "test-user",
    type: "activity",
    title: "School",
    color: "#F59E0B",
    movable: false,
    tz: TZ,
    recurrence: {
      freq: "weekly",
      byWeekday: [1, 2, 3, 4, 5],
      timeStart: "08:30",
      timeEnd: "15:00",
      startDate: "2026-07-01",
    },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function studyTask(): Item {
  return {
    id: "study-1",
    userId: "test-user",
    type: "task",
    title: "English study",
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

describe("AI apply integration (validate → write)", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(createManyItems).mockReset();
    vi.mocked(updateItem).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(listItems).mockResolvedValue([schoolWeekdays(), studyTask()]);
    vi.mocked(createManyItems).mockResolvedValue([]);
    vi.mocked(updateItem).mockImplementation(async (_u, id, patch) => ({
      ...studyTask(),
      id,
      ...patch,
    }));
  });

  it("creates a task when the operation is valid", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Added Maths tonight.",
        operations: [
          {
            type: "createItem",
            itemType: "task",
            title: "Maths",
            movable: true,
            date: "2026-07-22",
            timeStart: "20:00",
            timeEnd: "21:00",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    expect(createManyItems).toHaveBeenCalledTimes(1);
  });

  it("rejects a mixed batch so no writes occur (all-or-nothing)", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        operations: [
          {
            type: "createItem",
            itemType: "task",
            title: "Valid task",
            movable: true,
            date: "2026-07-22",
            timeStart: "16:00",
            timeEnd: "17:00",
          },
          {
            type: "createItem",
            itemType: "task",
            title: "Broken",
            movable: true,
            date: "2026-07-22",
            timeStart: "18:00",
            timeEnd: "17:00", // end before start
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(false);
    expect(createManyItems).not.toHaveBeenCalled();
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("skips stale update itemIds and still applies valid creates", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        operations: [
          {
            type: "createItem",
            itemType: "task",
            title: "Valid task",
            movable: true,
            date: "2026-07-22",
            timeStart: "16:00",
            timeEnd: "17:00",
          },
          {
            type: "updateItem",
            itemId: "does-not-exist",
            title: "Ghost",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    expect(result.missingSkipped).toBe(1);
    expect(createManyItems).toHaveBeenCalledTimes(1);
  });

  it("does not shift an immovable school series without explicit intent", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        operations: [
          {
            type: "bulkShift",
            itemIds: ["school-1"],
            minutes: -15,
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(false);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("deletes a known movable task", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Removed English study.",
        operations: [{ type: "deleteItem", itemId: "study-1" }],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    expect(deleteItem).toHaveBeenCalledWith("test-user", "study-1");
  });

  it("snaps a soft-timed create off an occupied evening slot", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Added Maths practise.",
        operations: [
          {
            type: "createItem",
            itemType: "task",
            title: "Maths practise",
            movable: true,
            segments: [
              {
                date: "2026-07-22",
                timeStart: "19:00",
                timeEnd: "20:00",
              },
            ],
          },
        ],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        weekDates: [
          "2026-07-20",
          "2026-07-21",
          "2026-07-22",
          "2026-07-23",
          "2026-07-24",
          "2026-07-25",
          "2026-07-26",
        ],
        nowIso: "2026-07-22T12:00:00.000+10:00",
        userText: "add maths practise tomorrow for an hour",
      }
    );

    expect(result.ok).toBe(true);
    expect(createManyItems).toHaveBeenCalledTimes(1);
    const created = vi.mocked(createManyItems).mock.calls[0]![1]![0]!;
    const seg = created.segments![0]!;
    // Existing English study is 19:00–20:00 on 2026-07-22; must not land there.
    expect(seg.start.includes("T19:00")).toBe(false);
  });

  it("infers 'this time tomorrow' locally without Gemini", async () => {
    const { inferOneOffCreateFromMessage } = await import("@/lib/ai/apply");
    const op = inferOneOffCreateFromMessage(
      "add english study this time tomorrow",
      {
        tz: TZ,
        todayIso: "2026-07-23",
        nowIso: "2026-07-23T21:01:00.000+10:00",
      }
    );
    expect(op).toMatchObject({
      type: "createItem",
      title: "English study",
      segments: [
        {
          date: "2026-07-24",
          timeStart: "21:00",
          timeEnd: "22:00",
        },
      ],
    });
  });

  it("returns clarification when the model asks and proposes no ops", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        clarification: "Which days should school run?",
        operations: [],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    expect(result.clarification).toMatch(/days/i);
    expect(createManyItems).not.toHaveBeenCalled();
  });
});
