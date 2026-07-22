import { Type, type Schema } from "@google/genai";
import { z } from "zod";

/**
 * The AI returns a list of discrete operations plus an optional plain-language
 * summary or clarification. The schema given to Gemini is permissive (one flat
 * operation shape with many optional fields); strict, per-operation correctness
 * is enforced later by Zod and the apply pipeline. The model is never trusted
 * to produce database-ready data on its own.
 */

export const OPERATION_TYPES = [
  "createItem",
  "updateItem",
  "moveItem",
  "deleteItem",
  "skipOccurrence",
  "skipRange",
  "completeItem",
  "bulkShift",
] as const;

const segmentInput = z.object({
  date: z.string(),
  timeStart: z.string(),
  timeEnd: z.string(),
});

export const rawOperationSchema = z.object({
  type: z.enum(OPERATION_TYPES),
  itemId: z.string().optional(),
  itemIds: z.array(z.string()).optional(),
  itemType: z.enum(["task", "activity"]).optional(),
  title: z.string().optional(),
  color: z.string().optional(),
  movable: z.boolean().optional(),
  notes: z.string().optional(),
  schedulingRole: z.enum(["study_period"]).optional(),
  recurring: z.boolean().optional(),
  freq: z.enum(["daily", "weekly"]).optional(),
  byWeekday: z.array(z.number().int()).optional(),
  interval: z.number().int().optional(),
  date: z.string().optional(),
  segments: z.array(segmentInput).optional(),
  timeStart: z.string().optional(),
  timeEnd: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  newDate: z.string().optional(),
  scope: z.enum(["occurrence", "series"]).optional(),
  completed: z.boolean().optional(),
  minutes: z.number().int().optional(),
  explicit: z.boolean().optional(),
});

export const aiResponseSchema = z.object({
  summary: z.string().optional(),
  clarification: z.string().optional(),
  operations: z.array(rawOperationSchema).optional(),
});

export type RawOperation = z.infer<typeof rawOperationSchema>;
export type AiResponse = z.infer<typeof aiResponseSchema>;

/** JSON schema handed to Gemini for `responseSchema`. */
export const AI_RESPONSE_GEMINI_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "Short, friendly confirmation of what was done.",
    },
    clarification: {
      type: Type.STRING,
      description:
        "Set this INSTEAD of operations when the request is ambiguous, impossible, or missing required detail. Ask one concise question.",
    },
    operations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, enum: [...OPERATION_TYPES] },
          itemId: {
            type: Type.STRING,
            description: "Existing item id to act on.",
          },
          itemIds: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Item ids for bulkShift.",
          },
          itemType: { type: Type.STRING, enum: ["task", "activity"] },
          title: {
            type: Type.STRING,
            description:
              "REQUIRED for createItem. Short name for the item — infer from the student's message (e.g. 'workout' → 'Workout').",
          },
          color: {
            type: Type.STRING,
            description:
              "A colour name (green, blue, orange, red, purple, teal, pink, slate) or a #RRGGBB hex.",
          },
          movable: { type: Type.BOOLEAN },
          notes: { type: Type.STRING },
          schedulingRole: {
            type: Type.STRING,
            enum: ["study_period"],
            description: "Set study_period for study-line blocks the student can work in.",
          },
          recurring: { type: Type.BOOLEAN },
          freq: { type: Type.STRING, enum: ["daily", "weekly"] },
          byWeekday: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description: "Weekdays 1=Mon ... 7=Sun.",
          },
          interval: {
            type: Type.INTEGER,
            description: "Repeat every N weeks. Use 2 for Week A / Week B fortnightly timetables.",
          },
          date: { type: Type.STRING, description: "yyyy-MM-dd." },
          segments: {
            type: Type.ARRAY,
            description:
              "Time blocks for a single (non-recurring) item. Multiple blocks = one split task.",
            items: {
              type: Type.OBJECT,
              properties: {
                date: { type: Type.STRING },
                timeStart: { type: Type.STRING },
                timeEnd: { type: Type.STRING },
              },
              propertyOrdering: ["date", "timeStart", "timeEnd"],
            },
          },
          timeStart: { type: Type.STRING, description: "HH:mm (24h)." },
          timeEnd: { type: Type.STRING, description: "HH:mm (24h)." },
          startDate: { type: Type.STRING },
          endDate: { type: Type.STRING },
          newDate: { type: Type.STRING },
          scope: { type: Type.STRING, enum: ["occurrence", "series"] },
          completed: { type: Type.BOOLEAN },
          minutes: {
            type: Type.INTEGER,
            description:
              "For bulkShift: signed minutes to shift (negative = earlier). For updateItem: NEW duration in minutes from the item's start (e.g. 240 = 4 hours).",
          },
          explicit: {
            type: Type.BOOLEAN,
            description:
              "Set true ONLY when the user explicitly asked to move/change a fixed (immovable) item.",
          },
        },
        propertyOrdering: ["type", "itemId", "title"],
      },
    },
  },
  propertyOrdering: ["summary", "clarification", "operations"],
};
