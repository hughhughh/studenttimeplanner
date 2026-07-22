"use client";

import { DateTime } from "luxon";
import type { Occurrence } from "@/lib/types";
import { CheckIcon, CloseIcon, RepeatIcon } from "@/app/_components/icons";

interface Props {
  occurrence: Occurrence;
  tz: string;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  busy: boolean;
  onOpen: (occ: Occurrence) => void;
  onToggleComplete: (occ: Occurrence) => void;
  onDelete: (occ: Occurrence) => void;
  onReschedule: (occ: Occurrence) => void;
}

function timeLabel(iso: string, tz: string): string {
  return DateTime.fromISO(iso, { zone: tz }).toFormat("h:mm a").toLowerCase();
}

export default function ItemCard({
  occurrence,
  tz,
  top,
  height,
  lane,
  lanes,
  busy,
  onOpen,
  onToggleComplete,
  onDelete,
  onReschedule,
}: Props) {
  const { status, completable, completed, color } = occurrence;
  const isOverdue = status === "overdue";
  const isDone = status === "done";

  const widthPct = 100 / lanes;
  const leftPct = widthPct * lane;

  const accent = isDone ? "#66aa3c" : isOverdue ? "#f97316" : color;
  const bg = isDone
    ? "var(--accent-soft)"
    : isOverdue
      ? "var(--overdue-soft)"
      : "var(--surface)";

  const compact = height < 40;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(occurrence)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(occurrence);
      }}
      className="group absolute overflow-hidden rounded-lg border border-border text-left shadow-sm transition hover:z-10 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{
        top,
        height,
        left: `calc(${leftPct}% + 2px)`,
        width: `calc(${widthPct}% - 4px)`,
        background: bg,
        borderLeft: `3px solid ${accent}`,
        opacity: busy ? 0.6 : 1,
      }}
      title={occurrence.title}
    >
      <div className="flex h-full items-start gap-1.5 px-1.5 py-1">
        {completable ? (
          <button
            type="button"
            aria-label={completed ? "Mark incomplete" : "Mark done"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleComplete(occurrence);
            }}
            className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border-2 transition"
            style={{
              borderColor: isDone ? "#66aa3c" : accent,
              background: isDone ? "#66aa3c" : "transparent",
            }}
          >
            {isDone && <CheckIcon className="h-2.5 w-2.5 text-white" />}
          </button>
        ) : (
          <span
            className="mt-1 h-2 w-2 flex-none rounded-full"
            style={{ background: accent }}
          />
        )}

        <div className="min-w-0 flex-1 leading-tight">
          <div
            className={`flex items-center gap-1 truncate text-[11px] font-semibold ${
              isDone ? "text-muted line-through" : "text-foreground"
            }`}
          >
            <span className="truncate">{occurrence.title}</span>
            {occurrence.recurring && (
              <RepeatIcon className="h-2.5 w-2.5 flex-none text-muted" />
            )}
          </div>
          {!compact && (
            <div className="truncate text-[10px] text-muted">
              {timeLabel(occurrence.start, tz)} – {timeLabel(occurrence.end, tz)}
            </div>
          )}
          {isOverdue && !compact && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onReschedule(occurrence);
              }}
              className="mt-0.5 rounded bg-overdue px-1.5 py-0.5 text-[9px] font-semibold text-white"
            >
              Reschedule
            </button>
          )}
        </div>

        {!isDone && (
          <button
            type="button"
            aria-label="Delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(occurrence);
            }}
            className="flex h-4 w-4 flex-none items-center justify-center rounded text-muted opacity-0 transition hover:bg-black/5 hover:text-foreground group-hover:opacity-100"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        )}
      </div>
    </div>
  );
}
