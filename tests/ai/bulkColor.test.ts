import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types";
import { colorForSubjectTitle } from "@/lib/calendar/subjectColor";
import { ITEM_COLORS } from "@/lib/config";

vi.mock("@/lib/db/items", () => ({
  listItems: vi.fn(),
  createManyItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
}));

import { listItems, updateItem } from "@/lib/db/items";
import {
  applyAiResponse,
  extractBulkColorChange,
  extractSubjectColorAssignments,
  wantsConsistentSubjectColors,
} from "@/lib/ai/apply";

const TZ = "Australia/Sydney";
const stamp = "2026-07-01T00:00:00.000+10:00";

function subject(
  id: string,
  title: string,
  color: string,
  weekday: number
): Item {
  return {
    id,
    userId: "test-user",
    type: "activity",
    title,
    color,
    movable: false,
    tz: TZ,
    recurrence: {
      freq: "weekly",
      byWeekday: [weekday],
      timeStart: "09:00",
      timeEnd: "10:00",
      startDate: "2026-07-01",
    },
    createdAt: stamp,
    updatedAt: stamp,
  };
}

function softwareItems(): Item[] {
  return [
    subject("soft-1", "Software Engineering", "#3B82F6", 1),
    subject("soft-2", "12 Software Engineering", "#3B82F6", 3),
  ];
}

describe("extractBulkColorChange", () => {
  it("parses make-all-instances phrasing", () => {
    expect(
      extractBulkColorChange(
        "can you make all the instances of software be purple"
      )
    ).toEqual({ query: "software", color: "purple" });
  });

  it("does not steal multi-subject colour prompts", () => {
    expect(
      extractBulkColorChange(
        "make all subjects the same colours, e.g. maths be blue, english yellow"
      )
    ).toBeNull();
  });
});

describe("extractSubjectColorAssignments", () => {
  it("parses maths blue and english yellow examples", () => {
    expect(
      extractSubjectColorAssignments(
        "make all subjects the same colours, e.g. maths be blue, english yellow"
      )
    ).toEqual([
      { query: "maths", color: "blue" },
      { query: "english", color: "yellow" },
    ]);
  });
});

describe("subject colour helpers", () => {
  it("maps known subjects stably", () => {
    expect(colorForSubjectTitle("Maths")).toBe(ITEM_COLORS.blue);
    expect(colorForSubjectTitle("12 Maths")).toBe(ITEM_COLORS.blue);
    expect(colorForSubjectTitle("English")).toBe(ITEM_COLORS.yellow);
  });

  it("detects consistent-colour intent", () => {
    expect(
      wantsConsistentSubjectColors(
        "make all subjects the same colours, e.g. maths be blue"
      )
    ).toBe(true);
  });
});

describe("bulk colour by title", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(updateItem).mockReset();
    vi.mocked(listItems).mockResolvedValue(softwareItems());
    vi.mocked(updateItem).mockImplementation(async (_u, id, patch) => {
      const item = softwareItems().find((i) => i.id === id)!;
      return { ...item, ...patch };
    });
  });

  it("recolours by title even when the model sends stale itemIds", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "All Software Engineering activities will now be purple.",
        operations: [
          {
            type: "updateItem",
            itemId: "6a433a93ddaa69563141e3e3",
            color: "purple",
            scope: "series",
          },
        ],
      },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        userText: "can you make all the instances of software be purple",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.usedFallback).toBe(true);
    expect(result.applied).toBe(2);
    expect(updateItem).toHaveBeenCalledTimes(2);
  });

  it("applies multi-subject colours and fills the rest consistently", async () => {
    const items = [
      subject("m1", "Maths", "#111111", 1),
      subject("m2", "Maths", "#222222", 2),
      subject("e1", "English", "#333333", 3),
      subject("ec1", "Economics", "#444444", 4),
    ];
    vi.mocked(listItems).mockResolvedValue(items);
    vi.mocked(updateItem).mockImplementation(async (_u, id, patch) => {
      const item = items.find((i) => i.id === id)!;
      return { ...item, ...patch };
    });

    const result = await applyAiResponse(
      "test-user",
      { clarification: "Please specify colours", operations: [] },
      {
        tz: TZ,
        todayIso: "2026-07-22",
        userText:
          "make all subjects the same colours, e.g. maths be blue, english yellow",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.applied).toBeGreaterThanOrEqual(3);
    const byId = Object.fromEntries(
      vi.mocked(updateItem).mock.calls.map((c) => [c[1], c[2].color])
    );
    expect(byId.m1).toBe(ITEM_COLORS.blue);
    expect(byId.m2).toBe(ITEM_COLORS.blue);
    expect(byId.e1).toBe(ITEM_COLORS.yellow);
    expect(byId.ec1).toBe(ITEM_COLORS.green);
  });
});
