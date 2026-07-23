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

/** Gemini often fills unused optional fields with JSON null — treat as omitted. */
const optionalString = z
  .string()
  .nullish()
  .transform((v) => v ?? undefined);
const optionalBoolean = z
  .boolean()
  .nullish()
  .transform((v) => v ?? undefined);
const optionalNumber = z
  .number()
  .int()
  .nullish()
  .transform((v) => v ?? undefined);

export const rawOperationSchema = z.object({
  type: z.enum(OPERATION_TYPES),
  itemId: optionalString,
  itemIds: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? undefined),
  itemType: z
    .enum(["task", "activity"])
    .nullish()
    .transform((v) => v ?? undefined),
  title: optionalString,
  color: optionalString,
  movable: optionalBoolean,
  notes: optionalString,
  schedulingRole: z
    .enum(["study_period"])
    .nullish()
    .transform((v) => v ?? undefined),
  recurring: optionalBoolean,
  freq: z
    .enum(["daily", "weekly"])
    .nullish()
    .transform((v) => v ?? undefined),
  byWeekday: z
    .array(z.number().int())
    .nullish()
    .transform((v) => v ?? undefined),
  interval: optionalNumber,
  date: optionalString,
  segments: z
    .array(segmentInput)
    .nullish()
    .transform((v) => v ?? undefined),
  timeStart: optionalString,
  timeEnd: optionalString,
  startDate: optionalString,
  endDate: optionalString,
  newDate: optionalString,
  scope: z
    .enum(["occurrence", "series"])
    .nullish()
    .transform((v) => v ?? undefined),
  completed: optionalBoolean,
  minutes: optionalNumber,
  explicit: optionalBoolean,
});

export const aiResponseSchema = z.object({
  summary: optionalString,
  clarification: optionalString,
  operations: z
    .array(rawOperationSchema)
    .nullish()
    .transform((v) => v ?? undefined),
});

/**
 * Zod's nullish→transform output marks every optional field as a required
 * `T | undefined` key. For constructing ops in code/tests we want true
 * optionality (omit the key). Runtime parse behaviour is unchanged.
 */
type OptionalUndefinedKeys<T> = {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
} & {
  [K in keyof T as undefined extends T[K] ? never : K]: T[K];
};

export type RawOperation = OptionalUndefinedKeys<
  z.infer<typeof rawOperationSchema>
>;

/** Response shape used after parse / in tests — ops use the loose RawOperation. */
export type AiResponse = {
  summary?: string;
  clarification?: string;
  operations?: RawOperation[];
};

type OpType = (typeof OPERATION_TYPES)[number];

function isOpType(value: unknown): value is OpType {
  return (
    typeof value === "string" &&
    (OPERATION_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Gemini sometimes omits `type` even when the rest of the op is clear
 * (e.g. itemId + timeStart + scope → updateItem). Fill it in before Zod.
 */
export function inferOperationType(
  op: Record<string, unknown>
): OpType | undefined {
  if (isOpType(op.type)) return op.type;

  if (Array.isArray(op.itemIds) && typeof op.minutes === "number") {
    return "bulkShift";
  }
  if (op.itemId && op.startDate && op.endDate && !op.timeStart && !op.timeEnd) {
    return "skipRange";
  }
  if (op.itemId && typeof op.completed === "boolean") {
    return "completeItem";
  }
  if (
    op.itemId &&
    op.date &&
    !op.timeStart &&
    !op.timeEnd &&
    !op.newDate &&
    !op.title &&
    !op.color &&
    op.minutes === undefined
  ) {
    return "skipOccurrence";
  }
  if (op.itemId && (op.minutes !== undefined && op.minutes !== null) && !op.timeStart && !op.timeEnd && !op.title && !op.color) {
    return "moveItem";
  }
  if (
    op.itemId &&
    (op.timeStart ||
      op.timeEnd ||
      op.title ||
      op.color ||
      op.notes !== undefined ||
      op.newDate ||
      op.scope ||
      op.minutes !== undefined)
  ) {
    // Absolute "start at 12 every week" → updateItem (resize/keep end), not moveItem.
    return "updateItem";
  }
  if (op.itemId && !op.timeStart && !op.timeEnd && !op.date && !op.title) {
    return "deleteItem";
  }
  if (
    op.title ||
    op.segments ||
    op.recurring ||
    op.freq ||
    (Array.isArray(op.byWeekday) && op.byWeekday.length > 0)
  ) {
    return "createItem";
  }
  return undefined;
}

/** Repair common Gemini omissions so Zod can accept an otherwise-valid payload. */
export function repairAiResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.operations)) return raw;

  return {
    ...body,
    operations: body.operations.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const op = { ...(entry as Record<string, unknown>) };
      if (!isOpType(op.type)) {
        const inferred = inferOperationType(op);
        if (inferred) op.type = inferred;
      }
      // "12" / "12pm" style times sometimes arrive without minutes.
      if (typeof op.timeStart === "string" && /^\d{1,2}$/.test(op.timeStart.trim())) {
        op.timeStart = `${op.timeStart.trim().padStart(2, "0")}:00`;
      }
      if (typeof op.timeEnd === "string" && /^\d{1,2}$/.test(op.timeEnd.trim())) {
        op.timeEnd = `${op.timeEnd.trim().padStart(2, "0")}:00`;
      }
      return op;
    }),
  };
}

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
          type: {
            type: Type.STRING,
            enum: [...OPERATION_TYPES],
            description:
              "REQUIRED on every operation. Use updateItem to change an existing item's start/end/title/colour (e.g. start at 12:00 every week). Use moveItem only to shift an item by minutes or to a new slot keeping duration.",
          },
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
              "A colour name (green, blue, orange, red, purple, teal, pink, yellow, slate) or a #RRGGBB hex.",
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
              "For moveItem or bulkShift: signed minutes to shift the whole item (positive = later, negative = earlier); duration is preserved. For updateItem: NEW duration in minutes from the item's start (e.g. 240 = 4 hours).",
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
