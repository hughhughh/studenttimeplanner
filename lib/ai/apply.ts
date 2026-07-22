import { DateTime } from "luxon";
import type { Item, OccurrenceOverride, Segment } from "@/lib/types";
import {
  createManyItems,
  deleteItem as dbDeleteItem,
  listItems,
  updateItem as dbUpdateItem,
} from "@/lib/db/items";
import {
  itemCreateSchema,
  type ItemCreateInput,
} from "@/lib/validation/item";
import { dateTimeFrom, ISO_DATE, TIME_OF_DAY } from "@/lib/calendar/time";
import { DEFAULT_ITEM_COLOR, ITEM_COLORS } from "@/lib/config";
import type { AiResponse, RawOperation } from "@/lib/ai/operations";

export interface ApplyContext {
  tz: string;
  todayIso: string;
  weekDates?: string[];
  /** Original student message — used to infer a title when the model omits one. */
  userText?: string;
}

export interface ApplyResult {
  ok: boolean;
  summary?: string;
  clarification?: string;
  error?: string;
  applied?: number;
}

type PlannedAction =
  | { kind: "create"; input: ItemCreateInput }
  | { kind: "update"; id: string; patch: Record<string, unknown> }
  | { kind: "delete"; id: string };

class OpError extends Error {}

// --- small helpers -------------------------------------------------------

function resolveColor(value: string | undefined): string {
  if (!value) return DEFAULT_ITEM_COLOR;
  if (/^#([0-9a-fA-F]{6})$/.test(value)) return value;
  const named = ITEM_COLORS[value.toLowerCase()];
  return named ?? DEFAULT_ITEM_COLOR;
}

function shiftTime(hhmm: string, minutes: number): string {
  return DateTime.fromFormat(hhmm, TIME_OF_DAY)
    .plus({ minutes })
    .toFormat(TIME_OF_DAY);
}

function shiftIso(iso: string, minutes: number, tz: string): string {
  return DateTime.fromISO(iso, { zone: tz }).plus({ minutes }).toISO() ?? iso;
}

function datesInRange(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = DateTime.fromFormat(start, ISO_DATE);
  const last = DateTime.fromFormat(end, ISO_DATE);
  if (!cur.isValid || !last.isValid) return out;
  while (cur <= last) {
    out.push(cur.toFormat(ISO_DATE));
    cur = cur.plus({ days: 1 });
  }
  return out;
}

function signature(item: {
  type: string;
  title: string;
  segments?: Segment[];
  recurrence?: {
    freq: string;
    byWeekday: number[];
    timeStart: string;
    timeEnd: string;
    interval?: number;
  };
}): string {
  const head = `${item.type}|${item.title.trim().toLowerCase()}`;
  if (item.recurrence) {
    const r = item.recurrence;
    const interval = r.interval && r.interval > 1 ? `:i${r.interval}` : "";
    return `${head}|r:${r.freq}:${[...r.byWeekday].sort().join(",")}:${r.timeStart}-${r.timeEnd}${interval}`;
  }
  const blocks = (item.segments ?? [])
    .map((s) => `${s.start}/${s.end}`)
    .sort()
    .join(",");
  return `${head}|s:${blocks}`;
}

// --- per-operation planning ---------------------------------------------

/** Pull a short title from the student's message when the model forgets one. */
function inferTitleFromMessage(message: string): string | undefined {
  const m = message.trim().match(
    /^(?:can you |could you |please )?(?:add|put|schedule|fit|book|create|give me)\s+(?:a|an|my|the)?\s*(.+)$/i
  );
  if (!m?.[1]) return undefined;

  const stop =
    /\s+(?:in|on|for|at|around|every|this|next|tonight|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|from|until)\b/i;
  const raw = m[1].split(stop)[0]?.replace(/\s+/g, " ").trim();
  if (!raw || raw.length > 80) return undefined;

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/\bmonday\b|\bmon\b/i, 1],
  [/\btuesday\b|\btue\b/i, 2],
  [/\bwednesday\b|\bwed\b/i, 3],
  [/\bthursday\b|\bthu\b/i, 4],
  [/\bfriday\b|\bfri\b/i, 5],
  [/\bsaturday\b|\bsat\b/i, 6],
  [/\bsunday\b|\bsun\b/i, 7],
];

function inferWeekdayFromMessage(message: string): number | undefined {
  for (const [pattern, day] of WEEKDAY_WORDS) {
    if (pattern.test(message)) return day;
  }
  return undefined;
}

/** Nearest matching weekday on or after `fromIso` within the next 7 days. */
function dateOnOrAfterWeekday(
  fromIso: string,
  weekday: number,
  tz: string
): string {
  let cur = DateTime.fromFormat(fromIso, ISO_DATE, { zone: tz });
  for (let i = 0; i < 7; i++) {
    if (cur.weekday === weekday) return cur.toFormat(ISO_DATE);
    cur = cur.plus({ days: 1 });
  }
  return fromIso;
}

function resolveWeekdayDate(
  weekday: number,
  ctx: ApplyContext
): string {
  if (ctx.weekDates) {
    const match = ctx.weekDates.find(
      (d) => DateTime.fromFormat(d, ISO_DATE, { zone: ctx.tz }).weekday === weekday
    );
    if (match) return match;
  }
  return dateOnOrAfterWeekday(ctx.todayIso, weekday, ctx.tz);
}

function resolveCreateTitle(op: RawOperation, userText?: string): string {
  if (op.title?.trim()) return op.title.trim();
  if (op.notes?.trim()) return op.notes.trim();
  const inferred = userText ? inferTitleFromMessage(userText) : undefined;
  if (inferred) return inferred;
  throw new OpError("A new item needs a title.");
}

function buildCreate(op: RawOperation, ctx: ApplyContext): ItemCreateInput {
  const title = resolveCreateTitle(op, ctx.userText);
  const type = op.itemType ?? "task";
  const color = resolveColor(op.color);
  const movable = op.movable ?? type !== "activity";

  const isRecurring =
    op.recurring === true ||
    Boolean(op.freq) ||
    (Array.isArray(op.byWeekday) && op.byWeekday.length > 0 && !op.segments);

  let candidate: Record<string, unknown>;

  if (isRecurring) {
    const timeStart = op.timeStart ?? "17:00";
    const timeEnd = op.timeEnd ?? "18:00";
    const freq = op.freq ?? "weekly";
    let byWeekday = op.byWeekday ?? [];
    if (freq === "weekly" && byWeekday.length === 0 && op.date) {
      byWeekday = [DateTime.fromFormat(op.date, ISO_DATE).weekday];
    }
    if (freq === "weekly" && byWeekday.length === 0 && ctx.userText) {
      const day = inferWeekdayFromMessage(ctx.userText);
      if (day) byWeekday = [day];
    }
    if (freq === "weekly" && byWeekday.length === 0) {
      throw new OpError(`"${title}" needs a day (e.g. Friday = weekday 5).`);
    }
    candidate = {
      type,
      title,
      color,
      movable,
      notes: op.notes,
      schedulingRole: op.schedulingRole,
      tz: ctx.tz,
      recurrence: {
        freq,
        byWeekday,
        timeStart,
        timeEnd,
        startDate: op.startDate ?? op.date ?? ctx.todayIso,
        endDate: op.endDate,
        interval: op.interval && op.interval > 1 ? op.interval : undefined,
      },
      exceptions: [],
      overrides: {},
    };
  } else {
    let rawSegments =
      op.segments ??
      (op.date && op.timeStart && op.timeEnd
        ? [{ date: op.date, timeStart: op.timeStart, timeEnd: op.timeEnd }]
        : []);
    if (rawSegments.length === 0 && ctx.userText) {
      const day = inferWeekdayFromMessage(ctx.userText);
      if (day) {
        rawSegments = [
          {
            date: resolveWeekdayDate(day, ctx),
            timeStart: op.timeStart ?? "17:00",
            timeEnd: op.timeEnd ?? "18:00",
          },
        ];
      }
    }
    if (rawSegments.length === 0) {
      throw new OpError(`"${title}" is missing a date and time.`);
    }
    const segments: Segment[] = rawSegments.map((s) => {
      const start = dateTimeFrom(s.date, s.timeStart, ctx.tz);
      const end = dateTimeFrom(s.date, s.timeEnd, ctx.tz);
      return { start: start.toISO() ?? "", end: end.toISO() ?? "" };
    });
    candidate = {
      type,
      title,
      color,
      movable,
      notes: op.notes,
      tz: ctx.tz,
      segments,
    };
  }

  const parsed = itemCreateSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new OpError(`"${title}" is invalid: ${first?.message ?? "bad data"}.`);
  }
  return parsed.data;
}

function requireItem(op: RawOperation, byId: Map<string, Item>): Item {
  if (!op.itemId) throw new OpError("This change is missing which item to edit.");
  const item = byId.get(op.itemId);
  if (!item) throw new OpError("That item no longer exists.");
  return item;
}

function ensureMovable(item: Item, explicit: boolean | undefined) {
  if (!item.movable && !explicit) {
    throw new OpError(
      `"${item.title}" is fixed. Say explicitly if you want to move it.`
    );
  }
}

/**
 * updateItem covers metadata (title/colour/…) and schedule edits such as
 * changing how long an item lasts — either via timeStart/timeEnd or minutes as a
 * new duration kept from the existing start.
 */
function planUpdate(op: RawOperation, item: Item): PlannedAction {
  const patch: Record<string, unknown> = {};
  if (op.title?.trim()) patch.title = op.title.trim();
  if (op.color) patch.color = resolveColor(op.color);
  if (typeof op.movable === "boolean") patch.movable = op.movable;
  if (typeof op.notes === "string") patch.notes = op.notes;

  const wantsSchedule =
    Boolean(op.timeStart) ||
    Boolean(op.timeEnd) ||
    Boolean(op.segments?.length) ||
    Boolean(op.newDate) ||
    typeof op.minutes === "number";

  if (wantsSchedule) {
    if (!item.recurrence) {
      const segments: Segment[] = [...(item.segments ?? [])];
      if (op.segments && op.segments.length > 0) {
        const next = op.segments.map((s) => {
          const start = dateTimeFrom(s.date, s.timeStart, item.tz);
          const end = dateTimeFrom(s.date, s.timeEnd, item.tz);
          if (end <= start) throw new OpError("End time must be after start.");
          return {
            start: start.toISO() ?? "",
            end: end.toISO() ?? "",
          };
        });
        patch.segments = next;
      } else {
        let index = 0;
        if (op.date) {
          const found = segments.findIndex(
            (s) =>
              DateTime.fromISO(s.start, { zone: item.tz }).toFormat(ISO_DATE) ===
              op.date
          );
          if (found !== -1) index = found;
        }
        const current = segments[index];
        if (!current) {
          throw new OpError(`Could not find when "${item.title}" is on.`);
        }
        const curStart = DateTime.fromISO(current.start, { zone: item.tz });
        const curEnd = DateTime.fromISO(current.end, { zone: item.tz });
        const date = op.newDate ?? op.date ?? curStart.toFormat(ISO_DATE);
        let timeStart = op.timeStart ?? curStart.toFormat(TIME_OF_DAY);
        let timeEnd = op.timeEnd ?? curEnd.toFormat(TIME_OF_DAY);
        // minutes on updateItem = new duration from the (possibly new) start.
        if (typeof op.minutes === "number" && !op.timeEnd) {
          if (op.minutes <= 0) {
            throw new OpError("Duration must be a positive number of minutes.");
          }
          const startDt = dateTimeFrom(date, timeStart, item.tz);
          timeEnd = startDt.plus({ minutes: op.minutes }).toFormat(TIME_OF_DAY);
        }
        if (timeStart >= timeEnd) {
          throw new OpError("End time must be after start.");
        }
        segments[index] = {
          start: dateTimeFrom(date, timeStart, item.tz).toISO() ?? current.start,
          end: dateTimeFrom(date, timeEnd, item.tz).toISO() ?? current.end,
        };
        patch.segments = segments;
      }
    } else {
      const scope = op.scope ?? (op.date ? "occurrence" : "series");
      let timeStart = op.timeStart ?? item.recurrence.timeStart;
      let timeEnd = op.timeEnd ?? item.recurrence.timeEnd;
      if (typeof op.minutes === "number" && !op.timeEnd) {
        if (op.minutes <= 0) {
          throw new OpError("Duration must be a positive number of minutes.");
        }
        const startDt = DateTime.fromFormat(timeStart, TIME_OF_DAY, {
          zone: item.tz,
        });
        timeEnd = startDt.plus({ minutes: op.minutes }).toFormat(TIME_OF_DAY);
      }
      if (timeStart >= timeEnd) {
        throw new OpError("End time must be after start.");
      }
      if (scope === "series") {
        patch.recurrence = {
          ...item.recurrence,
          timeStart,
          timeEnd,
        };
      } else {
        if (!op.date) throw new OpError("Which day should this change on?");
        const overrides: Record<string, OccurrenceOverride> = {
          ...(item.overrides ?? {}),
        };
        overrides[op.date] = {
          ...(overrides[op.date] ?? {}),
          timeStart: op.timeStart ?? overrides[op.date]?.timeStart ?? timeStart,
          timeEnd,
        };
        patch.overrides = overrides;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    throw new OpError("Nothing to update on that item.");
  }
  return { kind: "update", id: item.id, patch };
}

function planMove(op: RawOperation, item: Item): PlannedAction {
  ensureMovable(item, op.explicit);

  if (!item.recurrence) {
    const segments: Segment[] = [...(item.segments ?? [])];
    let index = 0;
    if (op.date) {
      const found = segments.findIndex(
        (s) => DateTime.fromISO(s.start, { zone: item.tz }).toFormat(ISO_DATE) === op.date
      );
      if (found !== -1) index = found;
    }
    const current = segments[index];
    if (!current) throw new OpError(`Could not find when "${item.title}" is on.`);
    const curStart = DateTime.fromISO(current.start, { zone: item.tz });
    const curEnd = DateTime.fromISO(current.end, { zone: item.tz });
    const date = op.newDate ?? curStart.toFormat(ISO_DATE);
    const timeStart = op.timeStart ?? curStart.toFormat(TIME_OF_DAY);
    const timeEnd = op.timeEnd ?? curEnd.toFormat(TIME_OF_DAY);
    if (timeStart >= timeEnd) throw new OpError("End time must be after start.");
    segments[index] = {
      start: dateTimeFrom(date, timeStart, item.tz).toISO() ?? current.start,
      end: dateTimeFrom(date, timeEnd, item.tz).toISO() ?? current.end,
    };
    return { kind: "update", id: item.id, patch: { segments } };
  }

  const scope = op.scope ?? "occurrence";
  if (scope === "series") {
    const recurrence = {
      ...item.recurrence,
      timeStart: op.timeStart ?? item.recurrence.timeStart,
      timeEnd: op.timeEnd ?? item.recurrence.timeEnd,
    };
    if (recurrence.timeStart >= recurrence.timeEnd) {
      throw new OpError("End time must be after start.");
    }
    return { kind: "update", id: item.id, patch: { recurrence } };
  }

  if (!op.date) throw new OpError("Which day should this move on?");
  const overrides: Record<string, OccurrenceOverride> = {
    ...(item.overrides ?? {}),
  };
  overrides[op.date] = {
    ...(overrides[op.date] ?? {}),
    timeStart: op.timeStart ?? overrides[op.date]?.timeStart,
    timeEnd: op.timeEnd ?? overrides[op.date]?.timeEnd,
  };
  return { kind: "update", id: item.id, patch: { overrides } };
}

function planBulkShift(
  op: RawOperation,
  byId: Map<string, Item>
): PlannedAction[] {
  if (!op.itemIds || op.itemIds.length === 0 || typeof op.minutes !== "number") {
    throw new OpError("Bulk change is missing items or an amount.");
  }
  const actions: PlannedAction[] = [];
  for (const id of op.itemIds) {
    const item = byId.get(id);
    if (!item) continue;
    if (!item.movable && !op.explicit) continue; // never shift fixed items incidentally

    if (item.recurrence) {
      const recurrence = {
        ...item.recurrence,
        timeStart: shiftTime(item.recurrence.timeStart, op.minutes),
        timeEnd: shiftTime(item.recurrence.timeEnd, op.minutes),
      };
      const overrides: Record<string, OccurrenceOverride> = {};
      for (const [date, ov] of Object.entries(item.overrides ?? {})) {
        overrides[date] = {
          ...ov,
          timeStart: ov.timeStart ? shiftTime(ov.timeStart, op.minutes) : ov.timeStart,
          timeEnd: ov.timeEnd ? shiftTime(ov.timeEnd, op.minutes) : ov.timeEnd,
        };
      }
      actions.push({
        kind: "update",
        id: item.id,
        patch: { recurrence, overrides },
      });
    } else if (item.segments) {
      const segments = item.segments.map((s) => ({
        start: shiftIso(s.start, op.minutes!, item.tz),
        end: shiftIso(s.end, op.minutes!, item.tz),
      }));
      actions.push({ kind: "update", id: item.id, patch: { segments } });
    }
  }
  if (actions.length === 0) {
    throw new OpError("Nothing movable matched that bulk change.");
  }
  return actions;
}

// --- main entry ----------------------------------------------------------

export async function applyAiResponse(
  userId: string,
  response: AiResponse,
  ctx: ApplyContext
): Promise<ApplyResult> {
  const operations = response.operations ?? [];

  // Clarification short-circuits with zero writes.
  if (response.clarification && operations.length === 0) {
    return { ok: true, clarification: response.clarification };
  }
  if (operations.length === 0) {
    return {
      ok: true,
      clarification:
        response.clarification ?? "I'm not sure what to change — can you rephrase?",
    };
  }

  const existing = await listItems(userId);
  const byId = new Map(existing.map((i) => [i.id, i]));
  const existingSigs = new Set(existing.map((i) => signature(i)));

  const actions: PlannedAction[] = [];
  const errors: string[] = [];
  const batchSigs = new Set<string>();
  let duplicateCount = 0;

  for (const op of operations) {
    try {
      switch (op.type) {
        case "createItem": {
          const input = buildCreate(op, ctx);
          const sig = signature(input);
          if (existingSigs.has(sig) || batchSigs.has(sig)) {
            duplicateCount += 1;
            break; // skip duplicates rather than create them
          }
          batchSigs.add(sig);
          actions.push({ kind: "create", input });
          break;
        }
        case "updateItem": {
          actions.push(planUpdate(op, requireItem(op, byId)));
          break;
        }
        case "moveItem": {
          const item = requireItem(op, byId);
          actions.push(planMove(op, item));
          break;
        }
        case "deleteItem": {
          const item = requireItem(op, byId);
          actions.push({ kind: "delete", id: item.id });
          break;
        }
        case "skipOccurrence": {
          const item = requireItem(op, byId);
          if (!item.recurrence) throw new OpError(`"${item.title}" does not repeat.`);
          if (!op.date) throw new OpError("Which day should be skipped?");
          const exceptions = Array.from(
            new Set([...(item.exceptions ?? []), op.date])
          );
          actions.push({ kind: "update", id: item.id, patch: { exceptions } });
          break;
        }
        case "skipRange": {
          const item = requireItem(op, byId);
          if (!item.recurrence) throw new OpError(`"${item.title}" does not repeat.`);
          if (!op.startDate || !op.endDate) {
            throw new OpError("A range needs a start and end date.");
          }
          const range = datesInRange(op.startDate, op.endDate);
          const exceptions = Array.from(
            new Set([...(item.exceptions ?? []), ...range])
          );
          actions.push({ kind: "update", id: item.id, patch: { exceptions } });
          break;
        }
        case "completeItem": {
          const item = requireItem(op, byId);
          if (item.type !== "task") {
            throw new OpError(`"${item.title}" is an activity and can't be completed.`);
          }
          const completed = op.completed ?? true;
          const completedAt = completed ? new Date().toISOString() : null;
          if (item.recurrence) {
            if (!op.date) throw new OpError("Which day's task?");
            const overrides: Record<string, OccurrenceOverride> = {
              ...(item.overrides ?? {}),
            };
            overrides[op.date] = {
              ...(overrides[op.date] ?? {}),
              completed,
              completedAt,
            };
            actions.push({ kind: "update", id: item.id, patch: { overrides } });
          } else {
            actions.push({
              kind: "update",
              id: item.id,
              patch: { completed, completedAt },
            });
          }
          break;
        }
        case "bulkShift": {
          actions.push(...planBulkShift(op, byId));
          break;
        }
        default:
          throw new OpError("Unsupported operation.");
      }
    } catch (err) {
      if (err instanceof OpError) errors.push(err.message);
      else errors.push("Could not process part of that request.");
    }
  }

  // All-or-nothing: if anything failed validation, write nothing.
  if (errors.length > 0) {
    return { ok: false, error: errors[0] };
  }

  // Commit.
  const creates = actions.filter((a) => a.kind === "create");
  if (creates.length > 0) {
    await createManyItems(
      userId,
      creates.map((a) => (a as { input: ItemCreateInput }).input)
    );
  }
  for (const action of actions) {
    if (action.kind === "update") {
      await dbUpdateItem(userId, action.id, action.patch);
    } else if (action.kind === "delete") {
      await dbDeleteItem(userId, action.id);
    }
  }

  const summaryParts: string[] = [];
  if (response.summary) summaryParts.push(response.summary);
  if (duplicateCount > 0) {
    summaryParts.push(
      `${duplicateCount} item${duplicateCount > 1 ? "s" : ""} already existed and ${
        duplicateCount > 1 ? "were" : "was"
      } skipped.`
    );
  }
  const summary =
    summaryParts.join(" ") ||
    `Done — ${actions.length} change${actions.length > 1 ? "s" : ""} applied.`;

  return { ok: true, summary, applied: actions.length };
}
