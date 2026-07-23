import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Item } from "@/lib/types";
import { dateTimeFrom } from "@/lib/calendar/time";
import { isRedoRequest, isUndoRequest } from "@/lib/ai/undoDetect";

vi.mock("@/lib/db/items", () => ({
  listItems: vi.fn(),
  createManyItems: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getItem: vi.fn(),
}));

import {
  createManyItems,
  deleteItem,
  getItem,
  listItems,
  updateItem,
} from "@/lib/db/items";
import { applyAiResponse } from "@/lib/ai/apply";
import { applyUndoSnapshot } from "@/lib/ai/undo";

const TZ = "Australia/Sydney";
const stamp = "2026-07-01T00:00:00.000+10:00";

function studyTask(color = "#66AA3C"): Item {
  return {
    id: "study-1",
    userId: "test-user",
    type: "task",
    title: "Study",
    color,
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

describe("isUndoRequest", () => {
  it("recognises common undo phrasing", () => {
    expect(isUndoRequest("undo")).toBe(true);
    expect(isUndoRequest("undo the last change")).toBe(true);
    expect(isUndoRequest("can you undo that")).toBe(true);
    expect(isUndoRequest("make study purple")).toBe(false);
  });
});

describe("isRedoRequest", () => {
  it("recognises common redo phrasing", () => {
    expect(isRedoRequest("redo")).toBe(true);
    expect(isRedoRequest("redo that")).toBe(true);
    expect(isRedoRequest("can you redo the last change")).toBe(true);
    expect(isRedoRequest("undo")).toBe(false);
  });
});

describe("session undo snapshot", () => {
  beforeEach(() => {
    vi.mocked(listItems).mockReset();
    vi.mocked(createManyItems).mockReset();
    vi.mocked(updateItem).mockReset();
    vi.mocked(deleteItem).mockReset();
    vi.mocked(getItem).mockReset();
    vi.mocked(listItems).mockResolvedValue([studyTask()]);
    vi.mocked(updateItem).mockResolvedValue(studyTask());
    vi.mocked(deleteItem).mockResolvedValue(true);
    vi.mocked(createManyItems).mockResolvedValue([]);
    vi.mocked(getItem).mockResolvedValue(studyTask());
  });

  it("returns an undo snapshot that restores colour after update", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Made Study purple.",
        operations: [
          { type: "updateItem", itemId: "study-1", color: "purple" },
        ],
      },
      { tz: TZ, todayIso: "2026-07-22", userText: "make study purple" }
    );

    expect(result.ok).toBe(true);
    expect(result.undo?.steps).toHaveLength(1);
    expect(result.undo?.steps[0]).toMatchObject({
      kind: "restore",
      id: "study-1",
      patch: { color: "#66AA3C" },
    });

    const undone = await applyUndoSnapshot("test-user", result.undo!);
    expect(undone.ok).toBe(true);
    expect(updateItem).toHaveBeenCalledWith("test-user", "study-1", {
      color: "#66AA3C",
    });
  });

  it("undo recreates a deleted item", async () => {
    const result = await applyAiResponse(
      "test-user",
      {
        summary: "Deleted Study.",
        operations: [{ type: "deleteItem", itemId: "study-1" }],
      },
      { tz: TZ, todayIso: "2026-07-22", userText: "delete study" }
    );

    expect(result.ok).toBe(true);
    expect(result.undo?.steps[0]?.kind).toBe("recreate");

    await applyUndoSnapshot("test-user", result.undo!);
    expect(createManyItems).toHaveBeenCalled();
    const [, inputs] = vi.mocked(createManyItems).mock.calls.at(-1)!;
    expect(inputs[0].title).toBe("Study");
  });

  it("undo returns an inverse snapshot that redo can re-apply", async () => {
    vi.mocked(getItem).mockResolvedValue(studyTask("#A855F7"));

    const undone = await applyUndoSnapshot(
      "test-user",
      {
        label: "make study purple",
        steps: [
          { kind: "restore", id: "study-1", patch: { color: "#66AA3C" } },
        ],
      },
      { mode: "undo" }
    );

    expect(undone.ok).toBe(true);
    expect(undone.inverse?.steps).toEqual([
      { kind: "restore", id: "study-1", patch: { color: "#A855F7" } },
    ]);

    await applyUndoSnapshot("test-user", undone.inverse!, { mode: "redo" });
    expect(updateItem).toHaveBeenLastCalledWith("test-user", "study-1", {
      color: "#A855F7",
    });
  });
});
