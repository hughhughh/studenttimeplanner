"use client";

import { useState, useTransition } from "react";
import { DateTime } from "luxon";
import type { Occurrence } from "@/lib/types";
import { ITEM_COLORS } from "@/lib/config";
import {
  deleteOccurrence,
  deleteSeries,
  editOccurrence,
  toggleComplete,
  type EditScope,
} from "@/lib/actions/items";
import { RepeatIcon } from "@/app/_components/icons";

interface Props {
  /** Always defined; the parent mounts this modal only when an item is selected. */
  occurrence: Occurrence;
  tz: string;
  onClose: () => void;
}

function timeValue(iso: string, tz: string): string {
  return DateTime.fromISO(iso, { zone: tz }).toFormat("HH:mm");
}

export default function ItemModal({ occurrence: occ, tz, onClose }: Props) {
  const [title, setTitle] = useState(occ.title);
  const [color, setColor] = useState(occ.color);
  const [notes, setNotes] = useState(occ.notes ?? "");
  const [movable, setMovable] = useState(occ.movable);
  const [timeStart, setTimeStart] = useState(() => timeValue(occ.start, tz));
  const [timeEnd, setTimeEnd] = useState(() => timeValue(occ.end, tz));
  const [scope, setScope] = useState<EditScope>("occurrence");
  const [pending, startTransition] = useTransition();
  const dateLabel = DateTime.fromISO(occ.start, { zone: tz }).toFormat(
    "cccc d LLLL"
  );

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      onClose();
    });

  const save = () =>
    run(() =>
      editOccurrence({
        itemId: occ.itemId,
        date: occ.date,
        recurring: occ.recurring,
        segmentIndex: occ.segmentIndex,
        scope,
        title,
        color,
        notes,
        movable,
        timeStart,
        timeEnd,
      })
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ background: color }}
              />
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {occ.type}
                {occ.recurring && (
                  <RepeatIcon className="ml-1 inline h-3 w-3" />
                )}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted">{dateLabel}</p>
            {occ.status === "overdue" && !occ.completed && (
              <p className="mt-1 text-xs font-medium text-overdue">
                Overdue — pick a new time below, then save.
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-black/5"
          >
            Close
          </button>
        </div>

        <label className="block text-xs font-semibold text-muted">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-muted">
              Start
            </label>
            <input
              type="time"
              value={timeStart}
              onChange={(e) => setTimeStart(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted">End</label>
            <input
              type="time"
              value={timeEnd}
              onChange={(e) => setTimeEnd(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-muted">Colour</label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {Object.entries(ITEM_COLORS).map(([name, hex]) => (
              <button
                key={name}
                type="button"
                aria-label={name}
                onClick={() => setColor(hex)}
                className={`h-6 w-6 rounded-full border-2 transition ${
                  color.toLowerCase() === hex.toLowerCase()
                    ? "border-foreground"
                    : "border-transparent"
                }`}
                style={{ background: hex }}
              />
            ))}
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={movable}
            onChange={(e) => setMovable(e.target.checked)}
            className="h-4 w-4 accent-accent"
          />
          <span>Movable (AI may reschedule this around fixed items)</span>
        </label>

        <label className="mt-3 block text-xs font-semibold text-muted">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />

        {occ.recurring && (
          <div className="mt-3 rounded-lg bg-surface-muted p-2 text-xs">
            <span className="font-semibold text-muted">Time change applies to:</span>
            <div className="mt-1 flex gap-3">
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={scope === "occurrence"}
                  onChange={() => setScope("occurrence")}
                />
                This day
              </label>
              <label className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={scope === "series"}
                  onChange={() => setScope("series")}
                />
                Whole series
              </label>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={save}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>

          {occ.completable && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  toggleComplete({
                    itemId: occ.itemId,
                    date: occ.date,
                    recurring: occ.recurring,
                    completed: !occ.completed,
                  })
                )
              }
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-black/5"
            >
              {occ.completed ? "Mark incomplete" : "Mark done"}
            </button>
          )}

          <div className="ml-auto flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  deleteOccurrence({
                    itemId: occ.itemId,
                    date: occ.date,
                    recurring: occ.recurring,
                  })
                )
              }
              className="rounded-lg px-3 py-2 text-sm font-medium text-overdue hover:bg-overdue-soft"
            >
              {occ.recurring ? "Skip this day" : "Delete"}
            </button>
            {occ.recurring && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => deleteSeries(occ.itemId))}
                className="rounded-lg px-3 py-2 text-sm font-medium text-overdue hover:bg-overdue-soft"
              >
                Delete series
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
