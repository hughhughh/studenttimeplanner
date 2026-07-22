"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import type { Occurrence } from "@/lib/types";
import {
  PX_PER_MIN,
  SNAP_MINUTES,
  bodyHeight,
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
import TimetableReview, {
  type TimetableDraft,
} from "@/app/_components/TimetableReview";

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

const GRID_TEMPLATE =
  "repeat(5, minmax(0,1fr)) 14px repeat(2, minmax(0,1fr))";
const GUTTER = 52;
const STORAGE_KEY = "studenttimeplanner.workingHours";
const DRAG_THRESHOLD_PX = 4;

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
  const [draft, setDraft] = useState<TimetableDraft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(new Set());
  const [optimistic, setOptimistic] = useState<Record<string, OptimisticMove>>(
    {}
  );
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [, startTransition] = useTransition();

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
        setToast("Couldn't move that item. Try again.");
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

  const height = bodyHeight(hours.startHour, hours.endHour);
  const hourMarks = Array.from(
    { length: hours.endHour - hours.startHour + 1 },
    (_, i) => hours.startHour + i
  );

  const weekdayDays = days.slice(0, 5);
  const weekendDays = days.slice(5, 7);

  const dayHeader = (day: DayMeta) => (
    <div
      key={day.date}
      className={`flex flex-col items-center py-2 ${
        day.isPast ? "text-muted" : "text-foreground"
      }`}
    >
      <span
        className={`text-[11px] font-medium uppercase ${
          day.isToday ? "text-accent-strong" : ""
        }`}
      >
        {day.label}
      </span>
      <span
        className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
          day.isToday ? "bg-accent text-white" : ""
        }`}
      >
        {day.dayOfMonth}
      </span>
    </div>
  );

  const bodyColumn = (day: DayMeta) => (
    <DayColumn
      key={day.date}
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
  );

  return (
    <div className="flex h-full flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <Link href="/home" className="text-lg font-bold tracking-tight">
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

          <div className="flex items-center gap-1">
            <Link
              href={`/?w=${weekOffset - 1}`}
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-black/5"
              aria-label="Previous week"
            >
              ‹
            </Link>
            <Link
              href="/?w=0"
              className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:bg-black/5"
            >
              Today
            </Link>
            <Link
              href={`/?w=${weekOffset + 1}`}
              className="rounded-lg border border-border px-2.5 py-1.5 text-sm hover:bg-black/5"
              aria-label="Next week"
            >
              ›
            </Link>
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

      {toast && (
        <div className="border-b border-border bg-accent-soft px-4 py-2 text-sm text-accent-strong sm:px-6">
          {toast}
        </div>
      )}

      <div
        className={`stp-scroll flex-1 overflow-auto pb-28 ${
          drag ? "select-none" : ""
        }`}
      >
        <div className="min-w-[820px]">
          {/* Day headers */}
          <div
            className="sticky top-0 z-10 flex border-b border-border bg-surface/95 backdrop-blur"
            style={{ paddingLeft: GUTTER }}
          >
            <div
              className="grid flex-1"
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              {weekdayDays.map(dayHeader)}
              <div />
              {weekendDays.map(dayHeader)}
            </div>
          </div>

          {/* Time gutter + day bodies */}
          <div className="flex">
            <div className="relative flex-none" style={{ width: GUTTER, height }}>
              {hourMarks.map((h) => (
                <div
                  key={h}
                  className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted"
                  style={{ top: (h - hours.startHour) * 60 * PX_PER_MIN }}
                >
                  {h}:00
                </div>
              ))}
            </div>
            <div
              className="grid flex-1"
              style={{ gridTemplateColumns: GRID_TEMPLATE }}
            >
              {weekdayDays.map(bodyColumn)}
              <div />
              {weekendDays.map(bodyColumn)}
            </div>
          </div>
        </div>
      </div>

      <CommandBar
        weekContext={{
          weekDates: days.map((d) => d.date),
          tz,
          nowIso,
        }}
        onTimetableDraft={(d) => setDraft(d as TimetableDraft)}
      />

      {selected && (
        <ItemModal
          key={selected.key}
          occurrence={selected}
          tz={tz}
          onClose={() => setSelected(null)}
        />
      )}

      {draft && (
        <TimetableReview
          draft={draft}
          onClose={() => setDraft(null)}
          onConfirmed={(count) => {
            setDraft(null);
            setToast(
              `Added ${count} timetable ${count === 1 ? "entry" : "entries"}.`
            );
          }}
        />
      )}
    </div>
  );
}
