import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Item } from "@/lib/types";

vi.mock("@/lib/db/items", () => ({
  listItems: vi.fn(),
  createManyItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

import { listItems, createManyItems } from "@/lib/db/items";
import {
  applyAiResponse,
  inferOneOffCreateFromMessage,
  inferWeeklyCreateFromMessage,
} from "@/lib/ai/apply";
import { repairAiResponse } from "@/lib/ai/operations";

const TZ = "Australia/Sydney";

describe("inferWeeklyCreateFromMessage", () => {
  it("parses add … every friday with a time range", () => {
    expect(
      inferWeeklyCreateFromMessage(
        "add assembly every friday from 11:55am to 12:50pm"
      )
    ).toMatchObject({
      type: "createItem",
      title: "Assembly",
      itemType: "activity",
      recurring: true,
      freq: "weekly",
      byWeekday: [5],
      timeStart: "11:55",
      timeEnd: "12:50",
    });
  });

  it("parses plural weekday 'to sundays from 1-4pm' (user bug report)", () => {
    expect(
      inferWeeklyCreateFromMessage("add tutoring to sundays from 1-4pm")
    ).toMatchObject({
      type: "createItem",
      title: "Tutoring",
      itemType: "activity",
      movable: false,
      recurring: true,
      byWeekday: [7],
      timeStart: "13:00",
      timeEnd: "16:00",
    });
  });

  it("parses 'on mondays' and bare plural 'fridays'", () => {
    expect(
      inferWeeklyCreateFromMessage("add gym on mondays from 6 to 7pm")
    ).toMatchObject({
      title: "Gym",
      byWeekday: [1],
      timeStart: "18:00",
      timeEnd: "19:00",
    });
    expect(
      inferWeeklyCreateFromMessage("add piano fridays from 4-5pm")
    ).toMatchObject({
      title: "Piano",
      byWeekday: [5],
      timeStart: "16:00",
      timeEnd: "17:00",
    });
  });

  it("does not treat a one-off weekday as weekly", () => {
    expect(
      inferWeeklyCreateFromMessage("add english study on friday at 7pm")
    ).toBeNull();
  });
});

describe("inferOneOffCreateFromMessage vs weekly", () => {
  const ctx = {
    todayIso: "2026-07-22",
    nowIso: "2026-07-22T10:00:00.000+10:00",
    tz: TZ,
    weekDates: [
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
    ],
  };

  it("does not steal 'to sundays' as a one-off", () => {
    expect(
      inferOneOffCreateFromMessage("add tutoring to sundays from 1-4pm", ctx)
    ).toBeNull();
  });

  it("still creates a one-off on a singular weekday", () => {
    expect(
      inferOneOffCreateFromMessage(
        "add english study on friday from 7 to 8pm",
        ctx
      )
    ).toMatchObject({
      type: "createItem",
      title: "English study",
      segments: [{ date: "2026-07-24", timeStart: "19:00", timeEnd: "20:00" }],
    });
  });
});

describe("apply recovers from broken Gemini weekly create", () => {
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

  it("fills byWeekday from plural 'sundays' when the model omits it", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "I've added Tutoring every Sunday from 13:00 to 16:00.",
        operations: [
          {
            type: "createItem",
            itemType: "activity",
            title: "Tutoring",
            movable: false,
            recurring: true,
            // model forgot byWeekday + timeEnd, and mangled timeStart
            timeStart:
              "13:00:00.000Z[Australia/Sydney,13:00:00.000+10:00[Australia/Sydney]]",
          },
        ],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        nowIso: "2026-07-22T10:00:00.000+10:00",
        userText: "add tutoring to sundays from 1-4pm",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBe(1);
    expect(createManyItems).toHaveBeenCalledTimes(1);
    const [, inputs] = vi.mocked(createManyItems).mock.calls[0]!;
    expect(inputs[0]!.title).toBe("Tutoring");
    expect(inputs[0]!.recurrence?.byWeekday).toEqual([7]);
    expect(inputs[0]!.recurrence?.timeStart).toBe("13:00");
    expect(inputs[0]!.recurrence?.timeEnd).toBe("16:00");
  });

  it("recovers when the model omits weekday and times (uses the message)", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Sure!",
        operations: [
          {
            type: "createItem",
            title: "Tutoring",
            recurring: true,
            // no weekday, no times — buildCreate + message inference must fill in
          },
        ],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        nowIso: "2026-07-22T10:00:00.000+10:00",
        userText: "add tutoring to sundays from 1-4pm",
      }
    );

    expect(result.ok).toBe(true);
    expect(createManyItems).toHaveBeenCalled();
    const [, inputs] = vi.mocked(createManyItems).mock.calls[0]!;
    expect(inputs[0]!.recurrence?.byWeekday).toEqual([7]);
    expect(inputs[0]!.recurrence?.timeStart).toBe("13:00");
    expect(inputs[0]!.recurrence?.timeEnd).toBe("16:00");
  });
});

describe("repairAiResponse time sanitization", () => {
  it("strips timezone junk from timeStart/timeEnd", () => {
    const repaired = repairAiResponse({
      operations: [
        {
          type: "createItem",
          title: "Tutoring",
          timeStart:
            "13:00:00.000Z[Australia/Sydney,13:00:00.000+10:00[Australia/Sydney]]",
          timeEnd: "16:00:00.000Z",
        },
      ],
    }) as { operations: { timeStart: string; timeEnd: string }[] };

    expect(repaired.operations[0]!.timeStart).toBe("13:00");
    expect(repaired.operations[0]!.timeEnd).toBe("16:00");
  });
});
