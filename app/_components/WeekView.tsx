"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import type { Occurrence } from "@/lib/types";
import {
  PX_PER_MIN,
  SNAP_MINUTES,
  clampStartMinutes,
  minutesToTimeOfDay,
  snapMinutes,
  yToDayMinutes,
} from "@/lib/calendar/grid";
import { minutesIntoDay } from "@/lib/calendar/time";
import {
  deleteOccurrence,
  editOccurrence,
  toggleComplete,
} from "@/lib/actions/items";
import { logoutAction } from "@/app/actions/auth";
import DayColumn from "@/app/_components/DayColumn";
import ItemModal from "@/app/_components/ItemModal";
import CommandBar from "@/app/_components/CommandBar";

export interface DayMeta {
  date: string;
  weekday: number;
  label: string;
  dayOfMonth: number;
  isToday: boolean;
  isPast: boolean;
}

interface Props {
  days: DayMeta[];
  occurrences: Occurrence[];
  tz: string;
  defaultWorkingHours: { startHour: number; endHour: number };
  weekOffset: number;
  weekLabel: string;
  nowIso: string;
  dbConfigured: boolean;
  dbMessage?: string;
}

interface DragState {
  occ: Occurrence;
  /** Day the item started on (needed for recurring overrides). */
  originDate: string;
  durationMin: number;
  grabOffsetMin: number;
  date: string;
  startMin: number;
  moved: boolean;
  pointerId: number;
}

interface OptimisticMove {
  date: string;
  start: string;
  end: string;
}

const STORAGE_KEY = "studenttimeplanner.workingHours";
/**
 * Explicit day width. Compact trial was 6.75rem; full-bleed is ~11–14rem on
 * typical desktops. Midpoint that stays visibly island-sized:
 */
const DAY_COL_CLASS = "w-58"; /* 14.5rem / 232px */
const DRAG_THRESHOLD_PX = 4;

function isOverdueTask(occ: Occurrence): boolean {
  return occ.completable && !occ.completed && occ.status === "overdue";
}

function patchOccurrence(
  occ: Occurrence,
  patch: { date: string; start: string; end: string }
): Occurrence {
  return { ...occ, date: patch.date, start: patch.start, end: patch.end };
}

function moveFromDrag(
  drag: Pick<DragState, "date" | "startMin" | "durationMin">,
  tz: string
): OptimisticMove {
  const start = DateTime.fromFormat(
    `${drag.date} ${minutesToTimeOfDay(drag.startMin)}`,
    "yyyy-MM-dd HH:mm",
    { zone: tz }
  );
  const end = start.plus({ minutes: drag.durationMin });
  return {
    date: drag.date,
    start: start.toISO() ?? "",
    end: end.toISO() ?? "",
  };
}

function applyLocalMoves(
  occurrences: Occurrence[],
  optimistic: Record<string, OptimisticMove>,
  drag: DragState | null,
  tz: string
): Occurrence[] {
  return occurrences.map((occ) => {
    if (drag && occ.key === drag.occ.key) {
      return patchOccurrence(occ, moveFromDrag(drag, tz));
    }
    const pending = optimistic[occ.key];
    if (pending) return patchOccurrence(occ, pending);
    return occ;
  });
}

export default function WeekView({
  days,
  occurrences,
  tz,
  defaultWorkingHours,
  weekOffset,
  weekLabel,
  nowIso,
  dbConfigured,
  dbMessage,
}: Props) {
  const [hours, setHours] = useState(defaultWorkingHours);
  const [selected, setSelected] = useState<Occurrence | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Record<string, OptimisticMove>>(
    {}
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [, startTransition] = useTransition();
  /** Fingerprint of overdue set the user dismissed — re-show if the set changes. */
  const [overdueDismissedKey, setOverdueDismissedKey] = useState<string | null>(
    null
  );
  const [rescheduling, setRescheduling] = useState(false);
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Hydrate saved preference after mount (SSR uses the default to avoid mismatch).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setHours(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  // Drop optimistic patches once the server-rendered week matches them.
  useEffect(() => {
    setOptimistic((prev) => {
      const keys = Object.keys(prev);
      if (keys.length === 0) return prev;
      let changed = false;
      const next = { ...prev };
      for (const key of keys) {
        const move = prev[key];
        const server = occurrences.find((o) => o.key === key);
        if (
          server &&
          server.date === move.date &&
          minutesIntoDay(server.start, tz) === minutesIntoDay(move.start, tz) &&
          minutesIntoDay(server.end, tz) === minutesIntoDay(move.end, tz)
        ) {
          delete next[key];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [occurrences, tz]);

  const updateHours = (next: { startHour: number; endHour: number }) => {
    if (next.endHour <= next.startHour) return;
    setHours(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const displayOccurrences = useMemo(
    () => applyLocalMoves(occurrences, optimistic, drag, tz),
    [occurrences, optimistic, drag, tz]
  );

  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occ of displayOccurrences) {
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    }
    return map;
  }, [displayOccurrences]);

  const overdueTasks = useMemo(() => {
    const list = displayOccurrences.filter(isOverdueTask);
    list.sort((a, b) => a.end.localeCompare(b.end));
    return list;
  }, [displayOccurrences]);

  const overdueKey = overdueTasks.map((o) => o.key).join("|");
  const showOverduePrompt =
    overdueTasks.length > 0 && overdueDismissedKey !== overdueKey;

  const weekContext = useMemo(
    () => ({
      weekDates: days.map((d) => d.date),
      tz,
      nowIso,
    }),
    [days, tz, nowIso]
  );

  const rescheduleOverdue = () => {
    if (rescheduling || overdueTasks.length === 0) return;
    const listed = overdueTasks
      .map(
        (o) =>
          `"${o.title}" (id=${o.itemId}, was ${o.date}, duration keep the same length)`
      )
      .join("; ");
    const text =
      overdueTasks.length === 1
        ? `Reschedule my overdue incomplete task ${listed} to the next free slot sometime soon (today or the next free day this week). Prefer a study_period if one is free; otherwise evening. Keep the same duration. Do not ask for confirmation — just move it.`
        : `Reschedule these overdue incomplete tasks to the next free slots sometime soon (today or the next free days this week), without overlapping fixed items: ${listed}. Prefer study_period blocks when free; otherwise evenings. Keep each task's duration. Do not ask for confirmation — just move them.`;

    setRescheduling(true);
    startTransition(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 50_000);
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, context: weekContext }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          return;
        }
        if (data.clarification && !data.summary) {
          return;
        }
        setOverdueDismissedKey(overdueKey);
        router.refresh();
      } catch {
        // Keep the overdue prompt visible so the student can retry.
      } finally {
        clearTimeout(timer);
        setRescheduling(false);
      }
    });
  };

  const withBusy = (key: string, fn: () => Promise<void>) => {
    setBusyKeys((prev) => new Set(prev).add(key));
    startTransition(async () => {
      await fn();
      setBusyKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    });
  };

  const handleToggle = (occ: Occurrence) =>
    withBusy(occ.key, () =>
      toggleComplete({
        itemId: occ.itemId,
        date: occ.date,
        recurring: occ.recurring,
        completed: !occ.completed,
      })
    );

  const handleDelete = (occ: Occurrence) =>
    withBusy(occ.key, () =>
      deleteOccurrence({
        itemId: occ.itemId,
        date: occ.date,
        recurring: occ.recurring,
      })
    );

  const commitDrag = (state: DragState) => {
    const originStart = minutesIntoDay(state.occ.start, tz);
    const originEnd = minutesIntoDay(state.occ.end, tz);
    const sameSlot =
      state.date === state.originDate &&
      state.startMin === originStart &&
      state.startMin + state.durationMin === originEnd;
    if (sameSlot) return;

    const move = moveFromDrag(state, tz);
    if (!move.start || !move.end) return;

    // Recurring series: only time overrides on the original day (not cross-day).
    const targetDate = state.occ.recurring ? state.originDate : state.date;
    const timeStart = minutesToTimeOfDay(state.startMin);
    const timeEnd = minutesToTimeOfDay(state.startMin + state.durationMin);

    // Keep the card where it was dropped until the server week catches up.
    setOptimistic((prev) => ({ ...prev, [state.occ.key]: move }));

    startTransition(async () => {
      try {
        await editOccurrence({
          itemId: state.occ.itemId,
          date: targetDate,
          recurring: state.occ.recurring,
          segmentIndex: state.occ.segmentIndex,
          scope: "occurrence",
          timeStart,
          timeEnd,
        });
      } catch {
        setOptimistic((prev) => {
          const next = { ...prev };
          delete next[state.occ.key];
          return next;
        });
      }
    });
  };

  const handleDragStart = (
    occ: Occurrence,
    date: string,
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    if (dragRef.current) return;

    const startMin = minutesIntoDay(occ.start, tz);
    const endMin = minutesIntoDay(occ.end, tz);
    const durationMin = Math.max(endMin - startMin, SNAP_MINUTES);
    const cardRect = e.currentTarget.getBoundingClientRect();
    const grabOffsetMin = (e.clientY - cardRect.top) / PX_PER_MIN;

    const initial: DragState = {
      occ,
      originDate: date,
      durationMin,
      grabOffsetMin,
      date,
      startMin,
      moved: false,
      pointerId: e.pointerId,
    };
    dragRef.current = initial;

    const onMove = (ev: PointerEvent) => {
      const current = dragRef.current;
      if (!current || ev.pointerId !== current.pointerId) return;

      const dx = ev.clientX - e.clientX;
      const dy = ev.clientY - e.clientY;
      const moved =
        current.moved ||
        Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;
      if (!moved) return;

      // Prefer the day column under the cursor; fall back to origin day.
      const under = document.elementFromPoint(ev.clientX, ev.clientY);
      const col = under?.closest("[data-day-date]") as HTMLElement | null;
      let nextDate = current.originDate;
      let colEl: HTMLElement | null = col;

      if (col?.dataset.dayDate) {
        // Recurring items stay on their day; single items can move across days.
        nextDate = current.occ.recurring
          ? current.originDate
          : col.dataset.dayDate;
        if (nextDate === col.dataset.dayDate) {
          colEl = col;
        } else {
          colEl =
            (document.querySelector(
              `[data-day-date="${nextDate}"]`
            ) as HTMLElement | null) ?? col;
        }
      } else {
        colEl = document.querySelector(
          `[data-day-date="${nextDate}"]`
        ) as HTMLElement | null;
      }

      if (!colEl) return;

      const rect = colEl.getBoundingClientRect();
      const y = ev.clientY - rect.top;
      const rawStart = yToDayMinutes(y, hours.startHour) - current.grabOffsetMin;
      const snapped = snapMinutes(rawStart);
      const start = clampStartMinutes(
        snapped,
        current.durationMin,
        hours.startHour,
        hours.endHour
      );

      const next: DragState = {
        ...current,
        moved: true,
        date: nextDate,
        startMin: start,
      };
      dragRef.current = next;
      setDrag(next);
    };

    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== initial.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);

      const finalState = dragRef.current;
      dragRef.current = null;
      setDrag(null);

      if (finalState?.moved) {
        // Pointer-up is followed by a click; don't open the detail modal.
        suppressClickRef.current = true;
        commitDrag(finalState);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const weekdayDays = days.slice(0, 5);
  const weekendDays = days.slice(5, 7);

  const dayIsland = (day: DayMeta) => (
    <div
      key={day.date}
      className={`${DAY_COL_CLASS} flex shrink-0 flex-col overflow-hidden rounded-xl border shadow-[0_1px_2px_rgba(24,24,27,0.04),0_8px_20px_rgba(24,24,27,0.06)] ${
        day.isToday
          ? "border-accent/35 bg-surface"
          : "border-border/80 bg-surface"
      }`}
    >
      <div
        className={`flex flex-col items-center border-b border-border/70 px-1 py-1.5 ${
          day.isPast ? "text-muted" : "text-foreground"
        } ${
          day.isToday
            ? "bg-accent-soft/50"
            : day.isPast
              ? "bg-surface-muted/60"
              : "bg-surface"
        }`}
      >
        <span
          className={`text-[10px] font-medium uppercase tracking-wide ${
            day.isToday ? "text-accent-strong" : ""
          }`}
        >
          {day.label}
        </span>
        <span
          className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            day.isToday ? "bg-accent text-white" : ""
          }`}
        >
          {day.dayOfMonth}
        </span>
      </div>
      <DayColumn
        date={day.date}
        occurrences={byDate.get(day.date) ?? []}
        tz={tz}
        startHour={hours.startHour}
        endHour={hours.endHour}
        isToday={day.isToday}
        isPast={day.isPast}
        busyKeys={busyKeys}
        draggingKey={drag?.occ.key ?? null}
        onOpen={(occ) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            return;
          }
          setSelected(occ);
        }}
        onToggleComplete={handleToggle}
        onDelete={handleDelete}
        onDragStart={handleDragStart}
      />
    </div>
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-lg font-bold tracking-tight">
            Student Time{" "}
            <span className="text-accent">Planner</span>
          </Link>
          <span className="hidden text-sm text-muted sm:inline">
            {weekLabel}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 text-xs text-muted sm:flex">
            <span>Hours</span>
            <select
              value={hours.startHour}
              onChange={(e) =>
                updateHours({ ...hours, startHour: Number(e.target.value) })
              }
              className="rounded-md border border-border bg-surface px-1.5 py-1"
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
            <span>–</span>
            <select
              value={hours.endHour}
              onChange={(e) =>
                updateHours({ ...hours, endHour: Number(e.target.value) })
              }
              className="rounded-md border border-border bg-surface px-1.5 py-1"
            >
              {Array.from({ length: 25 }, (_, h) => (
                <option key={h} value={h}>
                  {h}:00
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/folio"
            className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-black/5"
          >
            Folio
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-muted hover:bg-black/5"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      {!dbConfigured && (
        <div className="border-b border-border bg-overdue-soft px-4 py-2 text-sm text-overdue sm:px-6">
          {dbMessage ??
            "Could not reach the database. Check .env.local and restart the dev server."}
        </div>
      )}

      <div
        className={`stp-scroll min-h-0 flex-1 overflow-auto bg-background ${
          drag ? "select-none" : ""
        }`}
      >
        <div className="flex justify-center px-4 py-4">
          <div className="flex w-fit max-w-full flex-col">
            <div className="flex items-center gap-2">
              <Link
                href={`/planner?w=${weekOffset - 1}`}
                className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg text-muted shadow-sm transition hover:border-foreground/25 hover:bg-black/5 hover:text-foreground"
                aria-label="Previous week"
              >
                ‹
              </Link>

              <div className="flex min-w-0 gap-2.5">
                {weekdayDays.map(dayIsland)}
                <div className="w-2.5 shrink-0" aria-hidden />
                {weekendDays.map(dayIsland)}
              </div>

              <Link
                href={`/planner?w=${weekOffset + 1}`}
                className="flex h-9 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-lg text-muted shadow-sm transition hover:border-foreground/25 hover:bg-black/5 hover:text-foreground"
                aria-label="Next week"
              >
                ›
              </Link>
            </div>

            {weekOffset !== 0 && (
              <div className="mt-2 flex justify-center">
                <Link
                  href="/planner?w=0"
                  className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/5"
                >
                  This week
                </Link>
              </div>
            )}

            <div className="mt-4 w-full self-center" style={{ maxWidth: "36rem" }}>
              <CommandBar weekContext={weekContext} />

              {showOverduePrompt && (
                <div className="mt-2 flex items-center justify-between gap-3 px-1 py-1.5 text-xs text-muted">
                  <p className="min-w-0 truncate">
                    {overdueTasks.length === 1 ? (
                      <>
                        <span className="text-overdue">{overdueTasks[0].title}</span>
                        {" "}is overdue — reschedule?
                      </>
                    ) : (
                      <>
                        <span className="text-overdue">
                          {overdueTasks.length} overdue
                        </span>
                        {" — "}
                        {overdueTasks
                          .slice(0, 2)
                          .map((o) => o.title)
                          .join(", ")}
                        {overdueTasks.length > 2
                          ? ` +${overdueTasks.length - 2}`
                          : ""}
                        . Reschedule?
                      </>
                    )}
                  </p>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setOverdueDismissedKey(overdueKey)}
                      disabled={rescheduling}
                      className="text-muted hover:text-foreground disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={rescheduleOverdue}
                      disabled={rescheduling}
                      className="font-medium text-overdue hover:underline disabled:opacity-50"
                    >
                      {rescheduling ? "Rescheduling…" : "Reschedule"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selected && (
        <ItemModal
          key={selected.key}
          occurrence={selected}
          tz={tz}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
