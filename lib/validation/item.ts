import { z } from "zod";
import { DateTime } from "luxon";
import { ISO_DATE, TIME_OF_DAY } from "@/lib/calendar/time";

/**
 * Zod schemas: the single source of truth for what is allowed into the
 * database. The AI never writes directly; its output is funnelled through
 * these schemas so malformed or nonsensical data is rejected, not stored.
 */

const hexColor = z
  .string()
  .regex(/^#([0-9a-fA-F]{6})$/, "Color must be a 6-digit hex like #66AA3C");

const timeOfDay = z
  .string()
  .refine((t) => DateTime.fromFormat(t, TIME_OF_DAY).isValid, {
    message: "Time must be HH:mm",
  });

const isoDate = z
  .string()
  .refine((d) => DateTime.fromFormat(d, ISO_DATE).isValid, {
    message: "Date must be yyyy-MM-dd",
  });

const isoDateTime = z
  .string()
  .refine((s) => DateTime.fromISO(s).isValid, {
    message: "Must be an ISO datetime",
  });

export const weekdaySchema = z.number().int().min(1).max(7);

export const segmentSchema = z
  .object({
    start: isoDateTime,
    end: isoDateTime,
  })
  .refine((s) => DateTime.fromISO(s.end) > DateTime.fromISO(s.start), {
    message: "Segment end must be after start",
  });

export const recurrenceSchema = z
  .object({
    freq: z.enum(["daily", "weekly"]),
    byWeekday: z.array(weekdaySchema),
    timeStart: timeOfDay,
    timeEnd: timeOfDay,
    startDate: isoDate,
    endDate: isoDate.optional(),
    interval: z.number().int().min(1).max(4).optional(),
  })
  .refine(
    (r) =>
      DateTime.fromFormat(r.timeEnd, TIME_OF_DAY) >
      DateTime.fromFormat(r.timeStart, TIME_OF_DAY),
    { message: "Recurrence end time must be after start time" }
  )
  .refine((r) => !r.endDate || r.endDate >= r.startDate, {
    message: "Recurrence endDate must not be before startDate",
  })
  .refine((r) => r.freq === "daily" || r.byWeekday.length > 0, {
    message: "Weekly recurrence needs at least one weekday",
  });

export const overrideSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  color: hexColor.optional(),
  timeStart: timeOfDay.optional(),
  timeEnd: timeOfDay.optional(),
  notes: z.string().max(2000).optional(),
  completed: z.boolean().optional(),
  completedAt: z.string().nullable().optional(),
});

const baseItemFields = {
  type: z.enum(["task", "activity"]),
  title: z.string().min(1, "Title is required").max(200),
  color: hexColor,
  movable: z.boolean(),
  notes: z.string().max(2000).optional(),
  schedulingRole: z.enum(["study_period"]).optional(),
  tz: z.string().min(1),
};

/** A fully-formed item ready to insert: exactly one scheduling shape. */
export const itemCreateSchema = z
  .object({
    ...baseItemFields,
    segments: z.array(segmentSchema).min(1).optional(),
    recurrence: recurrenceSchema.optional(),
    exceptions: z.array(isoDate).optional(),
    overrides: z.record(z.string(), overrideSchema).optional(),
    completed: z.boolean().optional(),
    completedAt: z.string().nullable().optional(),
  })
  .refine((i) => Boolean(i.segments) !== Boolean(i.recurrence), {
    message: "An item must have either segments or a recurrence, not both",
  })
  .refine((i) => i.type === "task" || !i.completed, {
    message: "Only tasks can be completed",
  });

export type ItemCreateInput = z.infer<typeof itemCreateSchema>;
export type RecurrenceInput = z.infer<typeof recurrenceSchema>;
export type SegmentInput = z.infer<typeof segmentSchema>;
export type OverrideInput = z.infer<typeof overrideSchema>;
