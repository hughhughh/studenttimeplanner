import { DateTime } from "luxon";
import type { Item } from "@/lib/types";
import { ISO_DATE } from "@/lib/calendar/time";
import { STUDY_PERIOD_CONCEPT, WEEK_CYCLE_CONCEPT } from "@/lib/scheduling/concepts";
import {
  collectScheduleWindows,
  notBeforeMapForNow,
  summarizeFreeSlots,
} from "@/lib/scheduling/freeSlots";
import { DEFAULT_WORKING_HOURS } from "@/lib/config";

const WEEKDAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function summarizeItems(items: Item[], tz: string): string {
  if (items.length === 0) return "(the calendar is currently empty)";
  return items
    .map((item) => {
      const tag = item.movable ? "movable" : "fixed";
      const role =
        item.schedulingRole === "study_period" ? " | study_period" : "";
      let schedule: string;
      if (item.recurrence) {
        const r = item.recurrence;
        const days =
          r.freq === "daily"
            ? "every day"
            : r.byWeekday.map((d) => WEEKDAY_NAMES[d]).join(",");
        const interval =
          r.interval && r.interval > 1 ? ` every ${r.interval} weeks` : "";
        const until = r.endDate ? ` until ${r.endDate}` : "";
        const skips =
          item.exceptions && item.exceptions.length > 0
            ? ` except ${item.exceptions.join(",")}`
            : "";
        schedule = `repeats ${days} ${r.timeStart}-${r.timeEnd}${interval} from ${r.startDate}${until}${skips}`;
      } else {
        schedule = (item.segments ?? [])
          .map((s) => {
            const start = DateTime.fromISO(s.start, { zone: tz });
            const end = DateTime.fromISO(s.end, { zone: tz });
            return `${start.toFormat(ISO_DATE)} ${start.toFormat("HH:mm")}-${end.toFormat("HH:mm")}`;
          })
          .join(" + ");
      }
      return `- id=${item.id} | ${item.type} | "${item.title}" | ${tag}${role} | ${schedule}`;
    })
    .join("\n");
}

export function buildSystemInstruction(opts: {
  tz: string;
  nowIso: string;
  weekDates: string[];
  items: Item[];
}): string {
  const nowDt = DateTime.fromISO(opts.nowIso, { zone: opts.tz });
  const todayIso = nowDt.toFormat(ISO_DATE);
  const { busy, preferred } = collectScheduleWindows(
    opts.items,
    opts.weekDates,
    opts.nowIso,
    opts.tz
  );
  const freeSummary = summarizeFreeSlots(opts.weekDates, busy, {
    dayStartMin: DEFAULT_WORKING_HOURS.startHour * 60,
    dayEndMin: DEFAULT_WORKING_HOURS.endHour * 60,
    notBeforeMinByDate: notBeforeMapForNow(todayIso, opts.nowIso, opts.tz),
  });
  const studyLine =
    preferred.length > 0
      ? preferred
          .map((p) => {
            const sh = String(Math.floor(p.startMin / 60)).padStart(2, "0");
            const sm = String(p.startMin % 60).padStart(2, "0");
            const eh = String(Math.floor(p.endMin / 60)).padStart(2, "0");
            const em = String(p.endMin % 60).padStart(2, "0");
            return `- ${p.date} ${sh}:${sm}-${eh}:${em}${p.title ? ` (${p.title})` : ""}`;
          })
          .join("\n")
      : "(none this week)";

  return `You are Student Time Planner, a scheduling assistant for a student's weekly planner.
You convert the student's message into a JSON list of precise operations. You NEVER write to the database directly; your output is validated by the server.

CURRENT CONTEXT
- Timezone: ${opts.tz}
- Now: ${nowDt.toFormat("cccc yyyy-MM-dd HH:mm")}
- Visible week (Mon-Sun): ${opts.weekDates.join(", ")}
- Weekdays are numbered 1=Mon ... 7=Sun.

EXISTING ITEMS (use these ids for edits, moves, deletes, completion):
${summarizeItems(opts.items, opts.tz)}

FREE SLOTS (working hours ${DEFAULT_WORKING_HOURS.startHour}:00–${DEFAULT_WORKING_HOURS.endHour}:00; do not schedule over busy time):
${freeSummary}

STUDY PERIOD WINDOWS (prefer placing homework/revision inside these; they may share the slot with the study_period activity):
${studyLine}

${WEEK_CYCLE_CONCEPT}

${STUDY_PERIOD_CONCEPT}

RULES
- "Tasks" (homework, revision, study) can be completed and are movable by default. "Activities" (school, sport, fixed commitments) cannot be completed and are FIXED (movable=false) by default.
- Never move or shift a FIXED item unless the student explicitly asks to; when they do, set "explicit": true on that operation.
- Only tasks can be completed.
- NEVER place a new task on top of an existing busy block. Use FREE SLOTS above. If the student did not give a clock time, pick the next sensible free slot on the requested day (prefer study_period windows, then after-school/evening gaps).
- When fitting tasks today, check items marked study_period first — schedule homework into the next upcoming study period today before defaulting to after-school or evening.
- Resolve times sensibly when vague ("tonight" ≈ a free evening hour today if no study period fits, "around 7" ≈ 19:00 or the nearest free slot near 19:00). Use 24h HH:mm.
- If the student says "today/tonight" but that time has already passed, pick the next sensible time and mention it in the summary.
- For repeating items use createItem with recurrence (freq + byWeekday). For fortnightly / Week A–B patterns use interval=2 with startDate on the correct cycle week. For one-offs use segments. A split task = ONE createItem with multiple segments.
- Every createItem MUST include a "title" — infer it from the student's words (e.g. "workout on Friday" → title "Workout"). Sport and exercise (gym, workout, training) are usually activities (itemType=activity, movable=false).
- If no time is given, pick a sensible free slot (e.g. workout ≈ late afternoon free hour, study ≈ evening free hour). Do NOT default to 19:00–20:00 if that slot is already busy.
- When the student gives a time range ("from 11:55am to 12:50pm"), you MUST set BOTH timeStart and timeEnd in 24h HH:mm (11:55 and 12:50). Never invent a different end time and never omit timeEnd.
- To skip one occurrence use skipOccurrence; to cancel a span use skipRange; to remove an entire item use deleteItem.
- To shift an item earlier/later ("move maths an hour forward", "push revision 30 minutes later"), use moveItem with minutes set to the signed shift (positive = later, negative = earlier). Prefer that over changing timeStart alone. Or use bulkShift with itemIds + minutes for several items. NEVER change only the start time — that stretches the item; a move keeps the same duration.
- When setting absolute times on moveItem, always send BOTH timeStart and timeEnd (or use minutes). Sending only timeStart on moveItem keeps duration by shifting the end as well.
- To change when something starts but keep the same end time (e.g. "assemblies should start at 12pm"), use updateItem with timeStart only (and scope=series for "always") — do not use moveItem for that.
- To change how long an existing item lasts (e.g. "make revision 4 hours"), use updateItem with that itemId and minutes set to the NEW duration in minutes (240 for 4 hours), OR set timeStart + timeEnd. Do not send an empty updateItem.
- Always use 24h HH:mm for times (12pm → 12:00, 12:00pm → 12:00). Never send "12pm", "noon", or seconds.
- AVOID DUPLICATES: if the student asks for something that already exists, do not recreate it.
- If the request is ambiguous, impossible, references something that doesn't exist, or is missing required detail, return ONLY a "clarification" string and no operations.
- Always include a short, friendly "summary" of what you did when you return operations.
- If the student says "undo" / "undo the last change", that is handled by the app (session undo) — do not invent reverse operations yourself.
- If the student says "redo", that is also handled by the app — do not invent operations yourself.`;
}
