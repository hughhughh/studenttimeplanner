"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Occurrence } from "@/lib/types";
import { PX_PER_MIN, bodyHeight } from "@/lib/calendar/grid";
import {
  deleteOccurrence,
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

const GRID_TEMPLATE =
  "repeat(5, minmax(0,1fr)) 14px repeat(2, minmax(0,1fr))";
const GUTTER = 52;
const STORAGE_KEY = "studenttimeplanner.workingHours";

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

  const updateHours = (next: { startHour: number; endHour: number }) => {
    if (next.endHour <= next.startHour) return;
    setHours(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const byDate = useMemo(() => {
    const map = new Map<string, Occurrence[]>();
    for (const occ of occurrences) {
      const list = map.get(occ.date) ?? [];
      list.push(occ);
      map.set(occ.date, list);
    }
    return map;
  }, [occurrences]);

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
      occurrences={byDate.get(day.date) ?? []}
      tz={tz}
      startHour={hours.startHour}
      endHour={hours.endHour}
      isToday={day.isToday}
      isPast={day.isPast}
      busyKeys={busyKeys}
      onOpen={setSelected}
      onToggleComplete={handleToggle}
      onDelete={handleDelete}
      onReschedule={setSelected}
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

      <div className="stp-scroll flex-1 overflow-auto pb-28">
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
