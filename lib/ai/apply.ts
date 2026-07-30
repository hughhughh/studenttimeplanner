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
import {
  dateTimeFrom,
  ISO_DATE,
  TIME_OF_DAY,
  normalizeTimeOfDay,
  extractTimeRangeFromMessage,
  defaultEndFromStart,
} from "@/lib/calendar/time";
import { DEFAULT_ITEM_COLOR, ITEM_COLORS } from "@/lib/config";
import type { AiResponse, RawOperation } from "@/lib/ai/operations";
import {
  recurrenceSchema,
} from "@/lib/validation/item";
import {
  itemToCreateInput,
  snapshotFields,
  type UndoSnapshot,
  type UndoStep,
} from "@/lib/ai/undo";
import { colorForSubjectTitle } from "@/lib/calendar/subjectColor";
import {
  collectScheduleWindows,
  durationMinutesFromMessage,
  findNextFreeSlot,
  intervalsOverlapSlot,
  messageSpecifiesClockTime,
  notBeforeMapForNow,
  type TimeInterval,
} from "@/lib/scheduling/freeSlots";

export interface ApplyContext {
  tz: string;
  todayIso: string;
  weekDates?: string[];
  /** ISO now — used when snapping soft-timed creates off busy slots. */
  nowIso?: string;
  /** Original student message — used to infer a title when the model omits one. */
  userText?: string;
}

export interface ApplyResult {
  ok: boolean;
  summary?: string;
  clarification?: string;
  error?: string;
  applied?: number;
  /** How many create ops were skipped as duplicates. */
  duplicatesSkipped?: number;
  /** True when we synthesized a create from the user's words because the model returned none. */
  usedFallback?: boolean;
  /** How many ops were skipped because their itemId was not on the calendar. */
  missingSkipped?: number;
  /** Session-only reverse of this apply — client keeps a stack for “undo”. */
  undo?: UndoSnapshot;
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
  const shifted = DateTime.fromFormat(hhmm, TIME_OF_DAY).plus({ minutes });
  if (!shifted.isValid) {
    throw new OpError("That time shift produced an invalid time.");
  }
  return shifted.toFormat(TIME_OF_DAY);
}

function shiftIso(iso: string, minutes: number, tz: string): string {
  const shifted = DateTime.fromISO(iso, { zone: tz }).plus({ minutes });
  if (!shifted.isValid || !shifted.toISO()) {
    throw new OpError("That time shift produced an invalid datetime.");
  }
  return shifted.toISO()!;
}

function requireHhmm(raw: string | undefined, label: string): string | undefined {
  if (raw === undefined || raw === "") return undefined;
  const normalized = normalizeTimeOfDay(raw);
  if (!normalized) {
    throw new OpError(
      `${label} "${raw}" is not a valid time — use 24h HH:mm (e.g. 12:00).`
    );
  }
  return normalized;
}

/**
 * Resolve start/end for a move.
 * - Both endpoints given → use them.
 * - Only one endpoint → keep the original duration (shift the other end).
 * - Neither → keep current times (e.g. date-only move).
 */
function resolveMoveTimes(
  curStart: string,
  curEnd: string,
  op: { timeStart?: string; timeEnd?: string }
): { timeStart: string; timeEnd: string } {
  const timeStart = requireHhmm(op.timeStart, "Start time");
  const timeEnd = requireHhmm(op.timeEnd, "End time");
  const curStartDt = DateTime.fromFormat(curStart, TIME_OF_DAY);
  const curEndDt = DateTime.fromFormat(curEnd, TIME_OF_DAY);
  if (!curStartDt.isValid || !curEndDt.isValid) {
    throw new OpError("That item has an invalid existing time.");
  }
  const durationMin = curEndDt.diff(curStartDt, "minutes").minutes;
  if (!(durationMin > 0)) {
    throw new OpError("That item has an invalid duration.");
  }

  if (timeStart && timeEnd) {
    return { timeStart, timeEnd };
  }
  if (timeStart && !timeEnd) {
    const startDt = DateTime.fromFormat(timeStart, TIME_OF_DAY);
    const end = startDt.plus({ minutes: durationMin });
    if (!end.isValid || end.day !== startDt.day) {
      throw new OpError("Moving that item would push it past midnight.");
    }
    return { timeStart, timeEnd: end.toFormat(TIME_OF_DAY) };
  }
  if (timeEnd && !timeStart) {
    const endDt = DateTime.fromFormat(timeEnd, TIME_OF_DAY);
    const start = endDt.minus({ minutes: durationMin });
    if (!start.isValid || start.day !== endDt.day) {
      throw new OpError("Moving that item would push it past midnight.");
    }
    return { timeStart: start.toFormat(TIME_OF_DAY), timeEnd };
  }
  return { timeStart: curStart, timeEnd: curEnd };
}

function assertValidIso(iso: string | null, label: string): string {
  if (!iso || !DateTime.fromISO(iso).isValid) {
    throw new OpError(`${label} is not a valid datetime.`);
  }
  return iso;
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
    /^(?:can you |could you |please )?(?:add|put|schedule|fit|book|create|give me)\s+(?:(?:a|an|my|the)\s+)?(.+)$/i
  );
  if (!m?.[1]) return undefined;

  const stop =
    /\s+(?:in|on|to|for|at|around|every|each|this|next|tonight|today|tomorrow|mondays?|tuesdays?|wednesdays?|thursdays?|fridays?|saturdays?|sundays?|mons?|tues?|weds?|thurs?|fris?|sats?|suns?|from|until)\b/i;
  const raw = m[1].split(stop)[0]?.replace(/\s+/g, " ").trim();
  if (!raw || raw.length > 80) return undefined;

  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Plural forms matter — students say "sundays" / "fridays", not only "sunday". */
const WEEKDAY_WORDS: [RegExp, number][] = [
  [/\bmondays?\b|\bmons?\b/i, 1],
  [/\btuesdays?\b|\btues?\b/i, 2],
  [/\bwednesdays?\b|\bweds?\b/i, 3],
  [/\bthursdays?\b|\bthurs?\b/i, 4],
  [/\bfridays?\b|\bfris?\b/i, 5],
  [/\bsaturdays?\b|\bsats?\b/i, 6],
  [/\bsundays?\b|\bsuns?\b/i, 7],
];

const WEEKDAY_NAME =
  "monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun";
const WEEKDAY_PLURAL =
  "mondays|tuesdays|wednesdays|thursdays|fridays|saturdays|sundays";

function inferWeekdayFromMessage(message: string): number | undefined {
  for (const [pattern, day] of WEEKDAY_WORDS) {
    if (pattern.test(message)) return day;
  }
  return undefined;
}

/** True when the message implies a weekly repeat on a named weekday. */
function looksLikeWeeklyWeekday(message: string): boolean {
  // every/each Friday, every Fridays
  if (
    new RegExp(
      String.raw`\b(?:every|each)\s+(?:${WEEKDAY_NAME}|${WEEKDAY_PLURAL})\b`,
      "i"
    ).test(message)
  ) {
    return true;
  }
  // on/to Fridays (plural) — singular "on Friday" is a one-off
  if (
    new RegExp(
      String.raw`\b(?:on|to)\s+(?:${WEEKDAY_PLURAL})\b`,
      "i"
    ).test(message)
  ) {
    return true;
  }
  // bare "Fridays" / "Sundays"
  return new RegExp(String.raw`\b(?:${WEEKDAY_PLURAL})\b`, "i").test(message);
}

const ACTIVITY_TITLE =
  /\b(assembly|school|sport|training|gym|football|soccer|practice|lunch|chapel|homeroom|tutoring|tutor)\b/i;

/**
 * When the model returns no operations for a clear weekly create
 * ("add X every Friday…", "add tutoring to sundays from 1–4pm"), build it locally.
 */
export function inferWeeklyCreateFromMessage(
  message: string
): RawOperation | null {
  const text = message.trim();
  if (
    !/^(?:please\s+|can you\s+|could you\s+)?(?:add|put|schedule|book|create)\s+/i.test(
      text
    )
  ) {
    return null;
  }
  if (
    /\b(and then|also add|then add|move|delete|remove|skip|push|shift|complete|mark|reschedule|swap)\b/i.test(
      text
    )
  ) {
    return null;
  }
  if (!looksLikeWeeklyWeekday(text)) return null;

  const day = inferWeekdayFromMessage(text);
  const times = extractTimeRangeFromMessage(text);
  if (!day || !times.timeStart || !times.timeEnd) return null;

  const title =
    inferTitleFromMessage(text) ??
    (() => {
      const raw = text
        .replace(
          /^(?:please\s+|can you\s+|could you\s+)?(?:add|put|schedule|book|create)\s+(?:(?:a|an|my|the)\s+)?/i,
          ""
        )
        .replace(
          new RegExp(
            String.raw`\s+(?:every|each|on|to)\s+(?:${WEEKDAY_NAME}|${WEEKDAY_PLURAL})\b[\s\S]*$`,
            "i"
          ),
          ""
        )
        .replace(
          new RegExp(String.raw`\s+(?:${WEEKDAY_PLURAL})\b[\s\S]*$`, "i"),
          ""
        )
        .replace(/\s+from\s+.+$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!raw || raw.length > 80) return undefined;
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    })();
  if (!title) return null;

  const asActivity = ACTIVITY_TITLE.test(title);
  return {
    type: "createItem",
    title,
    itemType: asActivity ? "activity" : "task",
    movable: !asActivity,
    recurring: true,
    freq: "weekly",
    byWeekday: [day],
    timeStart: times.timeStart,
    timeEnd: times.timeEnd,
  };
}

function minToHhmm(totalMin: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMin));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Fast path for simple one-off adds ("add English study this time tomorrow",
 * "add maths practise tomorrow for an hour") so we don't wait on Gemini.
 */
export function inferOneOffCreateFromMessage(
  message: string,
  ctx: { todayIso: string; nowIso: string; tz: string; weekDates?: string[] }
): RawOperation | null {
  const text = message.trim();
  if (
    !/^(?:please\s+|can you\s+|could you\s+)?add\s+/i.test(text) ||
    looksLikeWeeklyWeekday(text) ||
    /\b(and then|also add|then add|move|delete|remove|skip|push|shift|complete|mark|reschedule|swap)\b/i.test(
      text
    )
  ) {
    return null;
  }

  let date: string | undefined;
  if (/\btomorrow\b/i.test(text)) {
    date = DateTime.fromFormat(ctx.todayIso, ISO_DATE, { zone: ctx.tz })
      .plus({ days: 1 })
      .toFormat(ISO_DATE);
  } else if (/\btoday\b|\btonight\b/i.test(text)) {
    date = ctx.todayIso;
  } else {
    const day = inferWeekdayFromMessage(text);
    if (day) date = resolveWeekdayDate(day, ctx);
  }
  if (!date) return null;

  const title =
    inferTitleFromMessage(text) ??
    (() => {
      const raw = text
        .replace(
          /^(?:please\s+|can you\s+|could you\s+)?add\s+(?:(?:a|an|my|the)\s+)?/i,
          ""
        )
        .replace(
          /\s+(?:this\s+time\s+)?(?:tomorrow|today|tonight)\b[\s\S]*$/i,
          ""
        )
        .replace(/\s+for\s+(?:an?\s+)?(?:\d+\s+)?(?:hours?|minutes?|mins?).*$/i, "")
        .replace(/\s+at\s+.+$/i, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!raw || raw.length > 80) return undefined;
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    })();
  if (!title) return null;

  const fromMsg = extractTimeRangeFromMessage(text);
  const duration =
    durationMinutesFromMessage(text) ??
    (fromMsg.timeStart && fromMsg.timeEnd
      ? undefined
      : 60);

  let timeStart = fromMsg.timeStart;
  let timeEnd = fromMsg.timeEnd;

  if (/\bthis\s+time\b/i.test(text)) {
    const now = DateTime.fromISO(ctx.nowIso, { zone: ctx.tz });
    if (!now.isValid) return null;
    const rounded = Math.round((now.hour * 60 + now.minute) / 5) * 5;
    timeStart = minToHhmm(rounded);
    timeEnd = minToHhmm(rounded + (duration ?? 60));
  } else if (timeStart && !timeEnd) {
    timeEnd = defaultEndFromStart(timeStart);
  } else if (!timeStart) {
    // Soft evening default — snapCreateOffBusy relocates if occupied.
    timeStart = "19:00";
    timeEnd = minToHhmm(19 * 60 + (duration ?? 60));
  }

  if (!timeStart || !timeEnd || timeStart >= timeEnd) return null;

  // Don't invent a slot that crosses midnight from "this time" near end of day.
  const startMin =
    DateTime.fromFormat(timeStart, TIME_OF_DAY).hour * 60 +
    DateTime.fromFormat(timeStart, TIME_OF_DAY).minute;
  const endMin =
    DateTime.fromFormat(timeEnd, TIME_OF_DAY).hour * 60 +
    DateTime.fromFormat(timeEnd, TIME_OF_DAY).minute;
  if (endMin > 24 * 60 - 1 || endMin <= startMin) {
    // Cap at 23:59 same day if needed
    if (startMin >= 23 * 60) return null;
    timeEnd = "23:59";
  }

  const asActivity = ACTIVITY_TITLE.test(title);
  return {
    type: "createItem",
    title,
    itemType: asActivity ? "activity" : "task",
    movable: !asActivity,
    segments: [{ date, timeStart, timeEnd }],
  };
}

const COLOR_NAMES = Object.keys(ITEM_COLORS)
  .sort((a, b) => b.length - a.length)
  .join("|");

/**
 * "make all software purple", "colour all instances of maths blue", etc.
 * Returns a title substring to match and a named colour.
 * Skips multi-colour prompts (those use extractSubjectColorAssignments).
 */
export function extractBulkColorChange(
  message: string
): { query: string; color: string } | null {
  const text = message.trim();
  const colorHits = [
    ...text.matchAll(new RegExp(String.raw`\b(${COLOR_NAMES})\b`, "gi")),
  ];
  // More than one named colour → not a single-subject bulk change.
  if (colorHits.length !== 1) return null;
  // "same colours" / "consistent colours" without "instances of X" is handled elsewhere.
  if (/\bsame\s+colou?rs?\b|\bconsistent\s+colou?rs?\b/i.test(text)) {
    return null;
  }

  const re = new RegExp(
    String.raw`(?:can you\s+|could you\s+|please\s+)?(?:make|set|colour|color)\s+(?:all\s+)?(?:(?:the\s+)?instances\s+of\s+)?(.+?)\s+(?:be\s+|to\s+)?(${COLOR_NAMES})\b`,
    "i"
  );
  const match = text.match(re);
  if (!match) return null;
  const query = match[1]
    .replace(/\b(all|the|instances|of|entries|items|classes|subjects)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!query || query.length > 80) return null;
  // Reject garbage leftovers like "same colours, e.g."
  if (/^(same|e\.g\.?|eg|for example|colours?|colors?)$/i.test(query)) {
    return null;
  }
  return { query, color: match[2].toLowerCase() };
}

/**
 * "maths be blue, english yellow" / "Maths blue, English yellow, Economics green"
 */
export function extractSubjectColorAssignments(
  message: string
): { query: string; color: string }[] {
  const re = new RegExp(
    String.raw`([A-Za-z][A-Za-z0-9 /&'.-]{0,40}?)\s+(?:be\s+|to\s+)?(${COLOR_NAMES})\b`,
    "gi"
  );
  const out: { query: string; color: string }[] = [];
  const seen = new Set<string>();
  for (const match of message.matchAll(re)) {
    const query = match[1]
      .replace(/^(?:e\.g\.?|eg|for example|like|including)\s+/i, "")
      .replace(/[,:;]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const color = match[2].toLowerCase();
    if (!query || query.length > 60) continue;
    if (
      /^(all|the|same|subjects?|classes?|instances|colours?|colors?|make|set)$/i.test(
        query
      )
    ) {
      continue;
    }
    const key = `${query.toLowerCase()}|${color}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ query, color });
  }
  return out;
}

export function wantsConsistentSubjectColors(message: string): boolean {
  return (
    /\bsame\s+colou?rs?\b/i.test(message) ||
    /\bconsistent\s+colou?rs?\b/i.test(message) ||
    /\bcolou?r\s+(?:each|every|by)\s+subject\b/i.test(message) ||
    /\bsubjects?\s+(?:the\s+)?same\s+colou?r/i.test(message)
  );
}

function itemsMatchingTitle(items: Item[], query: string): Item[] {
  const q = query.toLowerCase();
  const includes = items.filter((i) => i.title.toLowerCase().includes(q));
  if (includes.length > 0) return includes;
  // Also allow "software engineering" vs query "12 software engineering"
  const tokens = q.split(/\s+/).filter((t) => t.length > 2 && !/^\d+$/.test(t));
  if (tokens.length === 0) return [];
  return items.filter((i) => {
    const t = i.title.toLowerCase();
    return tokens.every((tok) => t.includes(tok));
  });
}

/** Build updateItem ops that paint matching titles a named/hex colour. */
function colorOpsForQuery(
  items: Item[],
  query: string,
  color: string
): RawOperation[] {
  return itemsMatchingTitle(items, query).map((item) => ({
    type: "updateItem" as const,
    itemId: item.id,
    color,
    scope: "series" as const,
  }));
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

/**
 * When the student did not name a clock time, snap a one-off create off any
 * busy overlap onto the next free slot (same day first, then following days).
 */
function snapCreateOffBusy(
  input: ItemCreateInput,
  ctx: ApplyContext,
  existing: Item[],
  extraBusy: TimeInterval[]
): ItemCreateInput {
  if (input.recurrence || !input.segments?.length) return input;
  if (ctx.userText && messageSpecifiesClockTime(ctx.userText)) return input;

  const nowIso =
    ctx.nowIso ??
    DateTime.fromFormat(ctx.todayIso, ISO_DATE, { zone: ctx.tz })
      .set({ hour: 12 })
      .toISO() ??
    new Date().toISOString();

  const weekDates =
    ctx.weekDates && ctx.weekDates.length > 0
      ? ctx.weekDates
      : [ctx.todayIso];
  const searchDates = [...weekDates];
  let cur = DateTime.fromFormat(ctx.todayIso, ISO_DATE, { zone: ctx.tz });
  for (let i = 0; i < 7; i++) {
    const d = cur.toFormat(ISO_DATE);
    if (!searchDates.includes(d)) searchDates.push(d);
    cur = cur.plus({ days: 1 });
  }

  const { busy, preferred } = collectScheduleWindows(
    existing,
    searchDates,
    nowIso,
    ctx.tz
  );
  const allBusy = [...busy, ...extraBusy];

  const nextSegments = input.segments.map((seg) => {
    const start = DateTime.fromISO(seg.start, { zone: ctx.tz });
    const end = DateTime.fromISO(seg.end, { zone: ctx.tz });
    if (!start.isValid || !end.isValid) return seg;
    const date = start.toFormat(ISO_DATE);
    const timeStart = start.toFormat(TIME_OF_DAY);
    const timeEnd = end.toFormat(TIME_OF_DAY);
    const durationMin = Math.max(
      1,
      Math.round(end.diff(start, "minutes").minutes)
    );
    const preferredDuration =
      (ctx.userText && durationMinutesFromMessage(ctx.userText)) || durationMin;

    if (!intervalsOverlapSlot(allBusy, date, timeStart, timeEnd)) {
      return seg;
    }

    // Prefer keeping the requested day; fall back to later search dates.
    const dates = [date, ...searchDates.filter((d) => d !== date && d >= date)];
    const slot = findNextFreeSlot({
      dates,
      busy: allBusy,
      preferred,
      durationMin: preferredDuration,
      notBeforeMinByDate: notBeforeMapForNow(ctx.todayIso, nowIso, ctx.tz),
      // Soft study/homework defaults to after-school rather than 6am.
      preferAfterMin: 15 * 60,
    });
    if (!slot) return seg;

    const startIso = dateTimeFrom(slot.date, slot.timeStart, ctx.tz).toISO();
    const endIso = dateTimeFrom(slot.date, slot.timeEnd, ctx.tz).toISO();
    if (!startIso || !endIso) return seg;
    return { start: startIso, end: endIso };
  });

  return { ...input, segments: nextSegments };
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
    // Prefer times the student wrote explicitly — the model often drops timeEnd
    // and our old default was a hard-coded 18:00 (looks like "6pm").
    const fromMsg = extractTimeRangeFromMessage(ctx.userText ?? "");
    const timeStart =
      fromMsg.timeStart ??
      requireHhmm(op.timeStart, "Start time") ??
      "17:00";
    const timeEnd =
      fromMsg.timeEnd ??
      requireHhmm(op.timeEnd, "End time") ??
      defaultEndFromStart(timeStart);
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
    if (timeStart >= timeEnd) {
      throw new OpError("End time must be after start.");
    }
    candidate = {
      type,
      title,
      color,
      movable,
      notes: op.notes ?? undefined,
      schedulingRole: op.schedulingRole ?? undefined,
      tz: ctx.tz,
      recurrence: {
        freq,
        byWeekday,
        timeStart,
        timeEnd,
        startDate: op.startDate ?? op.date ?? ctx.todayIso,
        endDate: op.endDate ?? undefined,
        interval: op.interval && op.interval > 1 ? op.interval : undefined,
      },
      exceptions: [],
      overrides: {},
    };
  } else {
    const fromMsg = extractTimeRangeFromMessage(ctx.userText ?? "");
    let rawSegments =
      op.segments ??
      (op.date && (op.timeStart || fromMsg.timeStart) && (op.timeEnd || fromMsg.timeEnd)
        ? [
            {
              date: op.date,
              timeStart: fromMsg.timeStart ?? op.timeStart!,
              timeEnd: fromMsg.timeEnd ?? op.timeEnd!,
            },
          ]
        : []);
    if (rawSegments.length === 0 && ctx.userText) {
      const day = inferWeekdayFromMessage(ctx.userText);
      if (day) {
        const timeStart =
          fromMsg.timeStart ?? op.timeStart ?? "17:00";
        const timeEnd =
          fromMsg.timeEnd ?? op.timeEnd ?? defaultEndFromStart(timeStart);
        rawSegments = [
          {
            date: resolveWeekdayDate(day, ctx),
            timeStart,
            timeEnd,
          },
        ];
      }
    }
    if (rawSegments.length === 0) {
      throw new OpError(`"${title}" is missing a date and time.`);
    }
    const segments: Segment[] = rawSegments.map((s) => {
      const timeStart =
        requireHhmm(s.timeStart, "Start time") ??
        fromMsg.timeStart ??
        "17:00";
      const timeEnd =
        requireHhmm(s.timeEnd, "End time") ??
        fromMsg.timeEnd ??
        defaultEndFromStart(timeStart);
      if (timeStart >= timeEnd) {
        throw new OpError("End time must be after start.");
      }
      const start = dateTimeFrom(s.date, timeStart, ctx.tz);
      const end = dateTimeFrom(s.date, timeEnd, ctx.tz);
      return {
        start: assertValidIso(start.toISO(), "Start"),
        end: assertValidIso(end.toISO(), "End"),
      };
    });
    candidate = {
      type,
      title,
      color,
      movable,
      notes: op.notes ?? undefined,
      tz: ctx.tz,
      segments,
    };
  }

  const parsed = itemCreateSchema.safeParse(candidate);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.length ? ` (${first.path.join(".")})` : "";
    throw new OpError(
      `"${title}" is invalid: ${first?.message ?? "bad data"}${where}.`
    );
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
 * Unlike moveItem, changing only timeStart keeps the existing end (resizes).
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
          const timeStart = requireHhmm(s.timeStart, "Start time")!;
          const timeEnd = requireHhmm(s.timeEnd, "End time")!;
          const start = dateTimeFrom(s.date, timeStart, item.tz);
          const end = dateTimeFrom(s.date, timeEnd, item.tz);
          if (!start.isValid || !end.isValid) {
            throw new OpError("Segment times are not a valid datetime.");
          }
          if (end <= start) throw new OpError("End time must be after start.");
          return {
            start: assertValidIso(start.toISO(), "Segment start"),
            end: assertValidIso(end.toISO(), "Segment end"),
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
        if (!curStart.isValid || !curEnd.isValid) {
          throw new OpError(`"${item.title}" has an invalid existing datetime.`);
        }
        const date = op.newDate ?? op.date ?? curStart.toFormat(ISO_DATE);
        let timeStart =
          requireHhmm(op.timeStart, "Start time") ??
          curStart.toFormat(TIME_OF_DAY);
        let timeEnd =
          requireHhmm(op.timeEnd, "End time") ?? curEnd.toFormat(TIME_OF_DAY);
        // minutes on updateItem = new duration from the (possibly new) start.
        if (typeof op.minutes === "number" && !op.timeEnd) {
          if (op.minutes <= 0) {
            throw new OpError("Duration must be a positive number of minutes.");
          }
          const startDt = dateTimeFrom(date, timeStart, item.tz);
          if (!startDt.isValid) {
            throw new OpError("Start time is not a valid datetime.");
          }
          timeEnd = startDt.plus({ minutes: op.minutes }).toFormat(TIME_OF_DAY);
        }
        if (timeStart >= timeEnd) {
          throw new OpError("End time must be after start.");
        }
        const startIso = dateTimeFrom(date, timeStart, item.tz).toISO();
        const endIso = dateTimeFrom(date, timeEnd, item.tz).toISO();
        segments[index] = {
          start: assertValidIso(startIso, "Start"),
          end: assertValidIso(endIso, "End"),
        };
        patch.segments = segments;
      }
    } else {
      const scope = op.scope ?? (op.date ? "occurrence" : "series");
      const curStart =
        (op.date && item.overrides?.[op.date]?.timeStart) ||
        item.recurrence.timeStart;
      const curEnd =
        (op.date && item.overrides?.[op.date]?.timeEnd) ||
        item.recurrence.timeEnd;
      let timeStart = requireHhmm(op.timeStart, "Start time") ?? curStart;
      let timeEnd = requireHhmm(op.timeEnd, "End time") ?? curEnd;
      if (typeof op.minutes === "number" && !op.timeEnd) {
        if (op.minutes <= 0) {
          throw new OpError("Duration must be a positive number of minutes.");
        }
        const startDt = DateTime.fromFormat(timeStart, TIME_OF_DAY, {
          zone: item.tz,
        });
        if (!startDt.isValid) {
          throw new OpError("Start time is not a valid datetime.");
        }
        timeEnd = startDt.plus({ minutes: op.minutes }).toFormat(TIME_OF_DAY);
      }
      if (timeStart >= timeEnd) {
        throw new OpError("End time must be after start.");
      }
      if (scope === "series") {
        const recurrence = {
          ...item.recurrence,
          timeStart,
          timeEnd,
        };
        const parsed = recurrenceSchema.safeParse(recurrence);
        if (!parsed.success) {
          throw new OpError(
            parsed.error.issues[0]?.message ?? "Invalid recurrence times."
          );
        }
        patch.recurrence = parsed.data;
      } else {
        if (!op.date) throw new OpError("Which day should this change on?");
        const overrides: Record<string, OccurrenceOverride> = {
          ...(item.overrides ?? {}),
        };
        overrides[op.date] = {
          ...(overrides[op.date] ?? {}),
          timeStart,
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

  // Relative shift ("an hour later") — move both ends; never stretch.
  if (
    typeof op.minutes === "number" &&
    !op.timeStart &&
    !op.timeEnd &&
    !op.newDate
  ) {
    if (op.minutes === 0) throw new OpError("Nothing to move.");
    if (!item.recurrence) {
      const segments = (item.segments ?? []).map((s) => ({
        start: shiftIso(s.start, op.minutes!, item.tz),
        end: shiftIso(s.end, op.minutes!, item.tz),
      }));
      return { kind: "update", id: item.id, patch: { segments } };
    }
    const scope = op.scope ?? (op.date ? "occurrence" : "series");
    if (scope === "series") {
      const recurrence = {
        ...item.recurrence,
        timeStart: shiftTime(item.recurrence.timeStart, op.minutes),
        timeEnd: shiftTime(item.recurrence.timeEnd, op.minutes),
      };
      const parsed = recurrenceSchema.safeParse(recurrence);
      if (!parsed.success) {
        throw new OpError(
          parsed.error.issues[0]?.message ?? "Invalid recurrence times."
        );
      }
      return {
        kind: "update",
        id: item.id,
        patch: { recurrence: parsed.data },
      };
    }
    if (!op.date) throw new OpError("Which day should this move on?");
    const curStart =
      item.overrides?.[op.date]?.timeStart ?? item.recurrence.timeStart;
    const curEnd =
      item.overrides?.[op.date]?.timeEnd ?? item.recurrence.timeEnd;
    const overrides: Record<string, OccurrenceOverride> = {
      ...(item.overrides ?? {}),
    };
    overrides[op.date] = {
      ...(overrides[op.date] ?? {}),
      timeStart: shiftTime(curStart, op.minutes),
      timeEnd: shiftTime(curEnd, op.minutes),
    };
    return { kind: "update", id: item.id, patch: { overrides } };
  }

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
    if (!curStart.isValid || !curEnd.isValid) {
      throw new OpError(`"${item.title}" has an invalid existing datetime.`);
    }
    const date = op.newDate ?? curStart.toFormat(ISO_DATE);
    const { timeStart, timeEnd } = resolveMoveTimes(
      curStart.toFormat(TIME_OF_DAY),
      curEnd.toFormat(TIME_OF_DAY),
      op
    );
    if (timeStart >= timeEnd) throw new OpError("End time must be after start.");
    segments[index] = {
      start: assertValidIso(
        dateTimeFrom(date, timeStart, item.tz).toISO(),
        "Start"
      ),
      end: assertValidIso(dateTimeFrom(date, timeEnd, item.tz).toISO(), "End"),
    };
    return { kind: "update", id: item.id, patch: { segments } };
  }

  const scope = op.scope ?? "occurrence";
  if (scope === "series") {
    const { timeStart, timeEnd } = resolveMoveTimes(
      item.recurrence.timeStart,
      item.recurrence.timeEnd,
      op
    );
    if (timeStart >= timeEnd) {
      throw new OpError("End time must be after start.");
    }
    const recurrence = { ...item.recurrence, timeStart, timeEnd };
    const parsed = recurrenceSchema.safeParse(recurrence);
    if (!parsed.success) {
      throw new OpError(
        parsed.error.issues[0]?.message ?? "Invalid recurrence times."
      );
    }
    return {
      kind: "update",
      id: item.id,
      patch: { recurrence: parsed.data },
    };
  }

  if (!op.date) throw new OpError("Which day should this move on?");
  const curStart =
    item.overrides?.[op.date]?.timeStart ?? item.recurrence.timeStart;
  const curEnd =
    item.overrides?.[op.date]?.timeEnd ?? item.recurrence.timeEnd;
  const { timeStart, timeEnd } = resolveMoveTimes(curStart, curEnd, op);
  if (timeStart >= timeEnd) throw new OpError("End time must be after start.");
  const overrides: Record<string, OccurrenceOverride> = {
    ...(item.overrides ?? {}),
  };
  overrides[op.date] = {
    ...(overrides[op.date] ?? {}),
    timeStart,
    timeEnd,
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
  let operations = [...(response.operations ?? [])];
  let usedFallback = false;

  const existing = await listItems(userId);

  // Colour-by-title: don't trust Gemini itemIds for recolour prompts.
  if (ctx.userText) {
    const assignments = extractSubjectColorAssignments(ctx.userText);
    const bulk = extractBulkColorChange(ctx.userText);
    const normalize = wantsConsistentSubjectColors(ctx.userText);
    const multiColour = assignments.length >= 2 || (normalize && assignments.length >= 1);

    const ops: RawOperation[] = [];
    const touched = new Set<string>();

    const pushColorOps = (query: string, color: string) => {
      for (const op of colorOpsForQuery(existing, query, color)) {
        if (op.itemId && !touched.has(op.itemId)) {
          touched.add(op.itemId);
          ops.push(op);
        }
      }
    };

    if (multiColour) {
      for (const pair of assignments) pushColorOps(pair.query, pair.color);
    } else if (bulk) {
      pushColorOps(bulk.query, bulk.color);
    } else if (assignments.length === 1) {
      pushColorOps(assignments[0]!.query, assignments[0]!.color);
    }

    if (normalize) {
      for (const item of existing) {
        if (item.type !== "activity") continue;
        if (touched.has(item.id)) continue;
        const next = colorForSubjectTitle(item.title);
        if (item.color === next) continue;
        touched.add(item.id);
        ops.push({
          type: "updateItem",
          itemId: item.id,
          color: next,
          scope: "series",
        });
      }
    }

    if (ops.length > 0) {
      operations = ops;
      usedFallback = true;
    } else if (
      operations.length === 0 &&
      (assignments.length > 0 || bulk)
    ) {
      const label = bulk?.query ?? assignments[0]?.query ?? "that subject";
      return {
        ok: true,
        clarification: `I couldn't find anything titled like "${label}" to recolour.`,
      };
    }
  }

  // Clarification short-circuits with zero writes — unless the student gave a
  // clear weekly create we can apply without the model.
  if (operations.length === 0 && ctx.userText) {
    const inferred = inferWeeklyCreateFromMessage(ctx.userText);
    if (inferred) {
      operations = [inferred];
      usedFallback = true;
    }
  }

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

  const byId = new Map(existing.map((i) => [i.id, i]));
  const existingSigs = new Set(existing.map((i) => signature(i)));

  const actions: PlannedAction[] = [];
  const errors: string[] = [];
  const batchSigs = new Set<string>();
  let duplicateCount = 0;
  const duplicateTitles: string[] = [];
  let missingSkipped = 0;
  /** Busy slots already claimed by earlier creates in this batch. */
  const batchBusy: TimeInterval[] = [];

  for (const op of operations) {
    try {
      switch (op.type) {
        case "createItem": {
          let input = buildCreate(op, ctx);
          input = snapCreateOffBusy(input, ctx, existing, batchBusy);
          const sig = signature(input);
          if (existingSigs.has(sig) || batchSigs.has(sig)) {
            duplicateCount += 1;
            duplicateTitles.push(input.title);
            break; // skip duplicates rather than create them
          }
          batchSigs.add(sig);
          for (const seg of input.segments ?? []) {
            const start = DateTime.fromISO(seg.start, { zone: ctx.tz });
            const end = DateTime.fromISO(seg.end, { zone: ctx.tz });
            if (!start.isValid || !end.isValid) continue;
            batchBusy.push({
              date: start.toFormat(ISO_DATE),
              startMin: start.hour * 60 + start.minute,
              endMin: end.hour * 60 + end.minute,
              title: input.title,
            });
          }
          actions.push({ kind: "create", input });
          break;
        }
        case "updateItem": {
          const item = op.itemId ? byId.get(op.itemId) : undefined;
          if (!item) {
            missingSkipped += 1;
            break;
          }
          actions.push(planUpdate(op, item));
          break;
        }
        case "moveItem": {
          const item = op.itemId ? byId.get(op.itemId) : undefined;
          if (!item) {
            missingSkipped += 1;
            break;
          }
          actions.push(planMove(op, item));
          break;
        }
        case "deleteItem": {
          const item = op.itemId ? byId.get(op.itemId) : undefined;
          if (!item) {
            missingSkipped += 1;
            break;
          }
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

  // All-or-nothing: if anything failed validation, write nothing —
  // unless the student message is a clear local create we can apply instead.
  if (errors.length > 0) {
    if (ctx.userText) {
      const local =
        inferWeeklyCreateFromMessage(ctx.userText) ??
        (ctx.nowIso
          ? inferOneOffCreateFromMessage(ctx.userText, {
              todayIso: ctx.todayIso,
              nowIso: ctx.nowIso,
              tz: ctx.tz,
              weekDates: ctx.weekDates,
            })
          : null);
      if (local) {
        // Drop userText so a second failure cannot recurse forever.
        const recovered = await applyAiResponse(
          userId,
          {
            summary: `Added ${local.title ?? "that item"}.`,
            operations: [local],
          },
          { ...ctx, userText: undefined }
        );
        return { ...recovered, usedFallback: true };
      }
    }
    return { ok: false, error: errors[0], usedFallback, missingSkipped };
  }

  if (actions.length === 0 && missingSkipped > 0) {
    return {
      ok: false,
      error:
        "Those calendar items couldn't be matched (stale ids). Try naming the subject again, e.g. “make all Software Engineering purple”.",
      missingSkipped,
      usedFallback,
    };
  }

  // Commit + build session undo (reverse in opposite order).
  const undoSteps: UndoStep[] = [];
  const creates = actions.filter((a) => a.kind === "create");
  if (creates.length > 0) {
    const created = await createManyItems(
      userId,
      creates.map((a) => (a as { input: ItemCreateInput }).input)
    );
    for (const item of created) {
      undoSteps.push({ kind: "delete", id: item.id });
    }
  }
  for (const action of actions) {
    if (action.kind === "update") {
      const item = byId.get(action.id);
      if (item) {
        undoSteps.push({
          kind: "restore",
          id: action.id,
          patch: snapshotFields(item, action.patch),
        });
      }
      await dbUpdateItem(userId, action.id, action.patch);
    } else if (action.kind === "delete") {
      const item = byId.get(action.id);
      if (item) {
        undoSteps.push({
          kind: "recreate",
          input: itemToCreateInput(item),
        });
      }
      await dbDeleteItem(userId, action.id);
    }
  }

  const undo: UndoSnapshot | undefined =
    undoSteps.length > 0
      ? { label: ctx.userText?.trim() || "last change", steps: undoSteps }
      : undefined;

  const summaryParts: string[] = [];
  if (actions.length > 0 && usedFallback && ctx.userText) {
    const assignments = extractSubjectColorAssignments(ctx.userText);
    const bulk = extractBulkColorChange(ctx.userText);
    if (assignments.length > 0) {
      const bits = assignments.map((a) => `${a.query}→${a.color}`).join(", ");
      summaryParts.push(
        `Updated colours for ${actions.length} item${actions.length > 1 ? "s" : ""} (${bits}).`
      );
    } else if (bulk) {
      summaryParts.push(
        `Made ${actions.length} “${bulk.query}” item${actions.length > 1 ? "s" : ""} ${bulk.color}.`
      );
    } else if (wantsConsistentSubjectColors(ctx.userText)) {
      summaryParts.push(
        `Gave each subject a consistent colour across ${actions.length} item${actions.length > 1 ? "s" : ""}.`
      );
    }
  }
  if (summaryParts.length === 0 && actions.length > 0 && response.summary && !usedFallback) {
    summaryParts.push(response.summary);
  } else if (summaryParts.length === 0 && actions.length > 0 && usedFallback) {
    const created = creates[0] as { input: ItemCreateInput } | undefined;
    const title = created?.input.title ?? "that item";
    const rec = created?.input.recurrence;
    if (rec) {
      summaryParts.push(
        `Added ${title} every week ${rec.timeStart}–${rec.timeEnd}.`
      );
    } else if (creates.length > 0) {
      summaryParts.push(`Added ${title}.`);
    }
  } else if (summaryParts.length === 0 && actions.length > 0) {
    summaryParts.push(
      `Done — ${actions.length} change${actions.length > 1 ? "s" : ""} applied.`
    );
  }

  if (duplicateCount > 0 && actions.length === 0) {
    const named = duplicateTitles[0] ?? "That item";
    return {
      ok: true,
      summary: `"${named}" is already on your calendar — nothing new was added. Check Friday on this or another week.`,
      applied: 0,
      duplicatesSkipped: duplicateCount,
      usedFallback,
      missingSkipped,
    };
  }
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

  return {
    ok: true,
    summary,
    applied: actions.length,
    duplicatesSkipped: duplicateCount,
    usedFallback,
    missingSkipped,
    undo,
  };
}
