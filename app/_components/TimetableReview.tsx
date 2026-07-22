"use client";

import { useState, useTransition } from "react";
import type { ItemCreateInput } from "@/lib/validation/item";
import { confirmTimetable } from "@/lib/actions/timetable";

export interface TimetableDraft {
  items: ItemCreateInput[];
  warnings: string[];
}

interface Props {
  /** Always defined; the parent mounts this only when a draft exists. */
  draft: TimetableDraft;
  onClose: () => void;
  onConfirmed: (count: number) => void;
}

const WEEKDAY_NAMES = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function describe(item: ItemCreateInput): string {
  if (item.recurrence) {
    const days = item.recurrence.byWeekday
      .map((d) => WEEKDAY_NAMES[d])
      .join(", ");
    const interval =
      item.recurrence.interval && item.recurrence.interval > 1
        ? " · every 2 weeks"
        : "";
    const study =
      item.schedulingRole === "study_period" ? " · study period" : "";
    return `${days} · ${item.recurrence.timeStart}–${item.recurrence.timeEnd}${interval}${study}`;
  }
  if (item.segments?.[0]) {
    return `${item.segments.length} block(s)`;
  }
  return "";
}

export default function TimetableReview({
  draft,
  onClose,
  onConfirmed,
}: Props) {
  const [included, setIncluded] = useState<boolean[]>(() =>
    draft.items.map(() => true)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const confirm = () => {
    const chosen = draft.items.filter((_, i) => included[i]);
    if (chosen.length === 0) {
      onClose();
      return;
    }
    startTransition(async () => {
      const result = await confirmTimetable(chosen);
      if (!result.ok) {
        setError(result.error ?? "Could not save timetable.");
        return;
      }
      onConfirmed(result.created);
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-2xl bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Review your timetable</h2>
        <p className="mt-1 text-sm text-muted">
          Check these before adding them. They&apos;ll be saved as fixed
          activities. Study periods are marked so the AI can schedule homework
          into them.
        </p>

        {draft.warnings.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-overdue-soft p-3 text-xs text-overdue">
            {draft.warnings.map((w, i) => (
              <li key={i}>• {w}</li>
            ))}
          </ul>
        )}

        <div className="stp-scroll mt-3 flex-1 space-y-2 overflow-y-auto">
          {draft.items.length === 0 && (
            <p className="text-sm text-muted">
              No subjects could be read from that image.
            </p>
          )}
          {draft.items.map((item, i) => (
            <label
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border p-3"
            >
              <input
                type="checkbox"
                checked={included[i] ?? false}
                onChange={(e) =>
                  setIncluded((prev) => {
                    const next = [...prev];
                    next[i] = e.target.checked;
                    return next;
                  })
                }
                className="h-4 w-4 accent-accent"
              />
              <span
                className="h-3 w-3 flex-none rounded-full"
                style={{ background: item.color }}
              />
              <span className="flex-1">
                <span className="block text-sm font-medium">{item.title}</span>
                <span className="block text-xs text-muted">
                  {describe(item)}
                </span>
              </span>
            </label>
          ))}
        </div>

        {error && <p className="mt-2 text-sm text-overdue">{error}</p>}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-black/5"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={confirm}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-strong disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add to calendar"}
          </button>
        </div>
      </div>
    </div>
  );
}
