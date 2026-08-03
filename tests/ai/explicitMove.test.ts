import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Item } from "@/lib/types";

vi.mock("@/lib/db/items", () => ({
  listItems: vi.fn(),
  createManyItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

import { listItems, updateItem } from "@/lib/db/items";
import {
  applyAiResponse,
  titleMentionedInText,
  userIntendsExplicitMove,
} from "@/lib/ai/apply";

const TZ = "Australia/Sydney";
const stamp = "2026-07-01T00:00:00.000+10:00";

function footballTraining(): Item {
  return {
    id: "fb-1",
    userId: "test-user",
    type: "activity",
    title: "Football training",
    color: "#3B82F6",
    movable: false,
    tz: TZ,
    recurrence: {
      freq: "weekly",
      interval: 1,
      byWeekday: [4],
      timeStart: "17:00",
      timeEnd: "18:30",
      startDate: "2026-07-01",
    },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

describe("explicit fixed-item moves", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(updateItem).mockReset();
    vi.mocked(listItems).mockResolvedValue([footballTraining()]);
    vi.mocked(updateItem).mockResolvedValue(footballTraining());
  });

  it("detects title mentions and move intent", () => {
    const msg = "Can you move football training on thursday back an hour";
    expect(titleMentionedInText(msg, "Football training")).toBe(true);
    expect(userIntendsExplicitMove(msg, "Football training")).toBe(true);
  });

  it("treats confirmation follow-ups as explicit intent", () => {
    const msg = [
      "Original request: Can you move football training on thursday back an hour",
      'Assistant asked: "Football training" is fixed. Say explicitly if you want to move it.',
      "Student reply: Yes, explicitly please move it",
    ].join("\n");
    expect(userIntendsExplicitMove(msg, "Football training")).toBe(true);
  });

  it("applies a named move of a fixed item without requiring explicit:true from the model", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Moved football training an hour later.",
        operations: [
          {
            type: "moveItem",
            itemId: "fb-1",
            minutes: 60,
            scope: "occurrence",
            date: "2026-07-23",
          },
        ],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        userText: "Can you move football training on thursday back an hour",
      }
    );

    expect(result.ok).toBe(true);
    expect(updateItem).toHaveBeenCalled();
  });

  it("still blocks anonymous moves of fixed items", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        operations: [
          {
            type: "moveItem",
            itemId: "fb-1",
            minutes: 60,
            scope: "occurrence",
            date: "2026-07-23",
          },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22" }
    );

    expect(result.ok).toBe(true);
    expect(result.clarification).toMatch(/fixed/i);
    expect(updateItem).not.toHaveBeenCalled();
  });
});
