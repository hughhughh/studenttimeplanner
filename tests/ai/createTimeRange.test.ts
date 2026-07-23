import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Item } from "@/lib/types";
import {
  extractTimeRangeFromMessage,
  normalizeTimeOfDay,
} from "@/lib/calendar/time";

vi.mock("@/lib/db/items", () => ({
  listItems: vi.fn(),
  createManyItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

import { listItems, createManyItems } from "@/lib/db/items";
import { applyAiResponse } from "@/lib/ai/apply";

const TZ = "Australia/Sydney";

describe("extractTimeRangeFromMessage", () => {
  it("parses from/to with am/pm", () => {
    expect(
      extractTimeRangeFromMessage(
        "add assembly every friday from 11:55am to 12:50pm"
      )
    ).toEqual({ timeStart: "11:55", timeEnd: "12:50" });
  });

  it("inherits pm when only the end has it", () => {
    expect(extractTimeRangeFromMessage("training 5 to 6:30pm")).toEqual({
      timeStart: "17:00",
      timeEnd: "18:30",
    });
  });

  it("handles en-dash ranges", () => {
    expect(extractTimeRangeFromMessage("school 8:30–15:00")).toEqual({
      timeStart: "08:30",
      timeEnd: "15:00",
    });
  });
});

describe("createItem respects stated end time", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(createManyItems).mockReset();
    vi.mocked(listItems).mockResolvedValue([]);
    vi.mocked(createManyItems).mockImplementation(async (_u, inputs) =>
      inputs.map(
        (input, i) =>
          ({
            id: `new-${i}`,
            userId: "test-user",
            createdAt: "2026-07-01T00:00:00.000+10:00",
            updatedAt: "2026-07-01T00:00:00.000+10:00",
            ...input,
          }) as Item
      )
    );
  });

  it("uses 12:50 from the message when the model omits timeEnd (old 18:00 default)", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Added Assembly every Friday.",
        operations: [
          {
            type: "createItem",
            itemType: "activity",
            title: "Assembly",
            movable: false,
            recurring: true,
            freq: "weekly",
            byWeekday: [5],
            timeStart: "11:55",
            // model forgot timeEnd — previously became 18:00
          },
        ],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        userText: "add assembly every friday from 11:55am to 12:50pm",
      }
    );

    expect(result.ok).toBe(true);
    expect(createManyItems).toHaveBeenCalledTimes(1);
    const [, inputs] = vi.mocked(createManyItems).mock.calls[0];
    expect(inputs[0].recurrence?.timeStart).toBe("11:55");
    expect(inputs[0].recurrence?.timeEnd).toBe("12:50");
  });

  it("prefers the message range over a wrong model timeEnd", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Added Assembly every Friday.",
        operations: [
          {
            type: "createItem",
            itemType: "activity",
            title: "Assembly",
            movable: false,
            recurring: true,
            freq: "weekly",
            byWeekday: [5],
            timeStart: "11:55",
            timeEnd: "18:00",
          },
        ],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        userText: "add assembly every friday from 11:55am to 12:50pm",
      }
    );

    expect(result.ok).toBe(true);
    const [, inputs] = vi.mocked(createManyItems).mock.calls[0];
    expect(inputs[0].recurrence?.timeEnd).toBe("12:50");
  });

  it("creates successfully when unused optionals are null", async () => {
    const parsed = (
      await import("@/lib/ai/operations")
    ).aiResponseSchema.safeParse({
      summary: "Added Assembly every Friday.",
      operations: [
        {
          type: "createItem",
          itemType: "activity",
          title: "Assembly",
          movable: false,
          recurring: true,
          freq: "weekly",
          byWeekday: [5],
          timeStart: "11:55",
          timeEnd: "12:50",
          endDate: null,
          notes: null,
          color: null,
          startDate: null,
        },
      ],
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;

    const result = await applyAiResponse("test-user", parsed.data, {
      tz: TZ,
      todayIso: "2026-07-22",
      userText: "add assembly every friday from 11:55am to 12:50pm",
    });

    expect(result.ok).toBe(true);
    expect(createManyItems).toHaveBeenCalled();
    const [, inputs] = vi.mocked(createManyItems).mock.calls[0];
    expect(inputs[0].recurrence?.timeStart).toBe("11:55");
    expect(inputs[0].recurrence?.timeEnd).toBe("12:50");
    expect(inputs[0].recurrence?.endDate).toBeUndefined();
  });
  it("creates from the user message when the model returns no operations", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Sure!",
        operations: [],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        userText: "add assembly every friday from 11:55am to 12:50pm",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(result.applied).toBe(1);
    expect(createManyItems).toHaveBeenCalledTimes(1);
    const [, inputs] = vi.mocked(createManyItems).mock.calls[0];
    expect(inputs[0].title).toBe("Assembly");
    expect(inputs[0].type).toBe("activity");
    expect(inputs[0].movable).toBe(false);
    expect(inputs[0].recurrence?.byWeekday).toEqual([5]);
    expect(inputs[0].recurrence?.timeStart).toBe("11:55");
    expect(inputs[0].recurrence?.timeEnd).toBe("12:50");
  });
});

describe("normalizeTimeOfDay afternoon", () => {
  it("keeps 12:50pm as 12:50 not 18:00", () => {
    expect(normalizeTimeOfDay("12:50pm")).toBe("12:50");
  });
});
