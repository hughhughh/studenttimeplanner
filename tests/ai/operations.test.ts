import { describe, expect, it } from "vitest";
import {
  aiResponseSchema,
  rawOperationSchema,
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
});
