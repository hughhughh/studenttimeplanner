import { describe, expect, it } from "vitest";
import {
  aiResponseSchema,
  rawOperationSchema,
  repairAiResponse,
} from "@/lib/ai/operations";

describe("AI operation schemas", () => {
  it("accepts a well-formed createItem operation", () => {
    const result = rawOperationSchema.safeParse({
      type: "createItem",
      itemType: "task",
      title: "English study",
      movable: true,
      date: "2026-07-22",
      timeStart: "19:00",
      timeEnd: "20:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown operation types", () => {
    const result = rawOperationSchema.safeParse({
      type: "hackTheCalendar",
      itemId: "x",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an AI response with summary and operations", () => {
    const result = aiResponseSchema.safeParse({
      summary: "Added an hour of English tonight.",
      operations: [
        {
          type: "createItem",
          itemType: "task",
          title: "English",
          timeStart: "19:00",
          timeEnd: "20:00",
          date: "2026-07-22",
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("accepts clarification-only responses", () => {
    const result = aiResponseSchema.safeParse({
      clarification: "Which school block should I move?",
      operations: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejects completely invalid payloads", () => {
    const result = aiResponseSchema.safeParse({
      operations: "not-an-array",
    });
    expect(result.success).toBe(false);
  });

  it("coerces Gemini null optionals to undefined", () => {
    const result = aiResponseSchema.safeParse({
      summary: "Added Assembly.",
      clarification: null,
      operations: [
        {
          type: "createItem",
          itemType: "activity",
          title: "Assembly",
          timeStart: "11:55",
          timeEnd: "12:50",
          endDate: null,
          notes: null,
          color: null,
          startDate: null,
          interval: null,
          byWeekday: [5],
          recurring: true,
          freq: "weekly",
        },
      ],
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const op = result.data.operations![0];
    expect(op.endDate).toBeUndefined();
    expect(op.notes).toBeUndefined();
    expect(op.color).toBeUndefined();
    expect(result.data.clarification).toBeUndefined();
  });

  it("repairs missing type on a series timeStart change as updateItem", () => {
    const repaired = repairAiResponse({
      operations: [
        {
          itemId: "6a61b7377b3239eef1bbb6e9",
          scope: "series",
          timeStart: "12:00",
        },
      ],
    });
    const result = aiResponseSchema.safeParse(repaired);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.operations![0].type).toBe("updateItem");
    expect(result.data.operations![0].timeStart).toBe("12:00");
    expect(result.data.operations![0].scope).toBe("series");
  });
});
