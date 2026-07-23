import { Type, type Schema } from "@google/genai";
import { z } from "zod";
import { generateJson } from "@/lib/ai/gemini";
import { itemCreateSchema, type ItemCreateInput } from "@/lib/validation/item";
import { ITEM_COLORS } from "@/lib/config";
import {
  cycleDayToWeekdayAndCycle,
  recurrenceFromCycle,
  type CycleWeek,
} from "@/lib/calendar/cycle";
import { WEEK_CYCLE_CONCEPT, STUDY_PERIOD_CONCEPT } from "@/lib/scheduling/concepts";
import { colorForSubjectTitle, normalizeSubjectKey } from "@/lib/calendar/subjectColor";

/**
 * Timetable image parsing. Gemini reads the photo and returns subject blocks;
 * the server turns each into a fixed weekly activity, re-validates it, and
 * returns a *draft* for the student to review. Nothing is written here — the
 * student confirms first, so a blurry or misread timetable can't silently
 * populate the calendar.
 */

const TIMETABLE_GEMINI_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    timetableType: {
      type: Type.STRING,
      enum: ["weekly", "fortnightly"],
      description:
        "weekly = same classes every week. fortnightly = Week A / Week B rotating cycle (days 1–10 or labelled Week A/B).",
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "Anything uncertain: blurry regions, guessed abbreviations, rotating weeks, unreadable cells.",
    },
    subjects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          isStudyPeriod: {
            type: Type.BOOLEAN,
            description:
              "True for study line, study period, private study, or similar blocks where the student can do their own work.",
          },
          cycleDay: {
            type: Type.INTEGER,
            description:
              "For fortnightly timetables: school day number 1–10 (1=Mon Week A … 5=Fri Week A, 6=Mon Week B … 10=Fri Week B).",
          },
          cycleWeek: {
            type: Type.STRING,
            enum: ["A", "B"],
            description:
              "For fortnightly timetables when cycleDay is not used: which cycle week this block is on.",
          },
          byWeekday: {
            type: Type.ARRAY,
            items: { type: Type.INTEGER },
            description:
              "Calendar weekday(s) 1=Mon … 7=Sun. For weekly timetables, or combined with cycleWeek for fortnightly.",
          },
          timeStart: { type: Type.STRING, description: "HH:mm (24h)." },
          timeEnd: { type: Type.STRING, description: "HH:mm (24h)." },
        },
        propertyOrdering: [
          "title",
          "isStudyPeriod",
          "cycleDay",
          "cycleWeek",
          "byWeekday",
          "timeStart",
          "timeEnd",
        ],
      },
    },
  },
  propertyOrdering: ["timetableType", "warnings", "subjects"],
};

const timetableSubjectSchema = z.object({
  title: z.string(),
  isStudyPeriod: z.boolean().optional(),
  cycleDay: z.number().int().min(1).max(10).optional(),
  cycleWeek: z.enum(["A", "B"]).optional(),
  byWeekday: z.array(z.number().int()).optional(),
  timeStart: z.string(),
  timeEnd: z.string(),
});

type TimetableSubject = z.infer<typeof timetableSubjectSchema>;

const timetableResultSchema = z.object({
  timetableType: z.enum(["weekly", "fortnightly"]).optional(),
  warnings: z.array(z.string()).optional(),
  subjects: z.array(timetableSubjectSchema).optional(),
});

const SYSTEM_INSTRUCTION = `You read a photo of a student's school timetable and extract each class block.

${WEEK_CYCLE_CONCEPT}

${STUDY_PERIOD_CONCEPT}

OUTPUT RULES
- Set timetableType to "fortnightly" when the timetable uses Week A/Week B, a 10-day cycle, or Day 1–10 labels. Otherwise "weekly".
- Return one "subjects" entry per distinct class block with start/end times in 24h HH:mm.
- For FORTNIGHTLY timetables, prefer cycleDay (1–10) when the timetable shows day numbers. Otherwise use cycleWeek ("A" or "B") plus byWeekday (1=Mon … 5=Fri).
- For WEEKLY timetables, use byWeekday (1=Mon … 7=Sun). Combine days that share the same subject and time into one entry.
- INCLUDE study periods / study lines / private study blocks: set isStudyPeriod=true and use a clear title like "Study Period". These are NOT recess, lunch, or blank cells.
- IGNORE recess, lunch, and empty free periods that are not labelled as study time.
- Use the times shown. If a period grid implies times, infer them, but add a warning that times were inferred.
- Expand obvious abbreviations (Eng→English, Mth→Maths) but add a warning listing any you guessed.
- Extract BOTH Week A and Week B blocks from fortnightly timetables — do not drop Week B.
- DO NOT invent subjects. If a region is unreadable, omit it and add a warning. If the image is not a timetable or is unreadable, return empty subjects with a clear warning.`;

export interface TimetableDraft {
  items: ItemCreateInput[];
  warnings: string[];
}

const STUDY_PERIOD_COLOR = ITEM_COLORS.slate;

function resolveRecurrence(
  subject: TimetableSubject,
  opts: {
    timetableType: "weekly" | "fortnightly";
    startDate: string;
    currentCycleWeek: CycleWeek;
  }
) {
  if (opts.timetableType === "fortnightly") {
    if (subject.cycleDay != null) {
      const { weekday, cycleWeek } = cycleDayToWeekdayAndCycle(subject.cycleDay);
      return recurrenceFromCycle({
        cycleWeek,
        weekday,
        timeStart: subject.timeStart,
        timeEnd: subject.timeEnd,
        anchorMonday: opts.startDate,
        currentCycleWeek: opts.currentCycleWeek,
      });
    }
    if (subject.cycleWeek && subject.byWeekday && subject.byWeekday.length > 0) {
      const weekday = subject.byWeekday[0]!;
      return recurrenceFromCycle({
        cycleWeek: subject.cycleWeek,
        weekday,
        timeStart: subject.timeStart,
        timeEnd: subject.timeEnd,
        anchorMonday: opts.startDate,
        currentCycleWeek: opts.currentCycleWeek,
      });
    }
    return null;
  }

  const byWeekday = subject.byWeekday ?? [];
  if (byWeekday.length === 0) return null;
  return {
    freq: "weekly" as const,
    byWeekday,
    timeStart: subject.timeStart,
    timeEnd: subject.timeEnd,
    startDate: opts.startDate,
  };
}

export async function parseTimetableImage(opts: {
  base64: string;
  mimeType: string;
  tz: string;
  startDate: string;
  /** Which cycle week (A or B) the anchor Monday belongs to. Default A. */
  currentCycleWeek?: CycleWeek;
}): Promise<TimetableDraft> {
  const currentCycleWeek = opts.currentCycleWeek ?? "A";

  const raw = await generateJson({
    systemInstruction: SYSTEM_INSTRUCTION,
    contents: [
      { inlineData: { mimeType: opts.mimeType, data: opts.base64 } },
      {
        text: "Extract every class block from this timetable, including both Week A and Week B if it is a rotating timetable.",
      },
    ],
    responseSchema: TIMETABLE_GEMINI_SCHEMA,
  });

  const parsed = timetableResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { items: [], warnings: ["The timetable could not be read."] };
  }

  const timetableType = parsed.data.timetableType ?? "weekly";
  const warnings = [...(parsed.data.warnings ?? [])];

  if (timetableType === "fortnightly") {
    warnings.push(
      "This is a Week A / Week B timetable — classes alternate every two weeks."
    );
  }

  const items: ItemCreateInput[] = [];
  /** Same subject title → same colour across every period block. */
  const colorBySubject = new Map<string, string>();

  (parsed.data.subjects ?? []).forEach((subject) => {
    const recurrence = resolveRecurrence(subject, {
      timetableType,
      startDate: opts.startDate,
      currentCycleWeek,
    });
    if (!recurrence) {
      warnings.push(
        `Skipped "${subject.title}" — could not determine which day(s) it runs on.`
      );
      return;
    }

    const isStudy = Boolean(subject.isStudyPeriod);
    const title = subject.title.trim();
    const key = normalizeSubjectKey(title) || title.toLowerCase();
    let color = colorBySubject.get(key);
    if (!color) {
      color = isStudy ? STUDY_PERIOD_COLOR : colorForSubjectTitle(title);
      colorBySubject.set(key, color);
    }

    const candidate = {
      type: "activity" as const,
      title,
      color,
      movable: false,
      schedulingRole: isStudy ? ("study_period" as const) : undefined,
      tz: opts.tz,
      recurrence,
      exceptions: [],
      overrides: {},
    };
    const result = itemCreateSchema.safeParse(candidate);
    if (result.success) {
      items.push(result.data);
    } else {
      warnings.push(`Skipped "${subject.title}" — its times looked invalid.`);
    }
  });

  return { items, warnings };
}
