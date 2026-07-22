"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import type { Occurrence } from "@/lib/types";
import {
  assignLanes,
  blockPosition,
  bodyHeight,
  PX_PER_MIN,
} from "@/lib/calendar/grid";
import ItemCard from "@/app/_components/ItemCard";
import NowIndicator from "@/app/_components/NowIndicator";

interface Props {
  date: string;
  occurrences: Occurrence[];
  tz: string;
  startHour: number;
  endHour: number;
  isToday: boolean;
  isPast: boolean;
  busyKeys: Set<string>;
  draggingKey: string | null;
  onOpen: (occ: Occurrence) => void;
  onToggleComplete: (occ: Occurrence) => void;
  onDelete: (occ: Occurrence) => void;
  onDragStart: (
    occ: Occurrence,
    date: string,
    e: ReactPointerEvent<HTMLDivElement>
  ) => void;
}

export default function DayColumn({
  date,
  occurrences,
  tz,
  startHour,
  endHour,
  isToday,
  isPast,
  busyKeys,
  draggingKey,
  onOpen,
  onToggleComplete,
  onDelete,
  onDragStart,
}: Props) {
  const height = bodyHeight(startHour, endHour);
  const placements = assignLanes(occurrences);
  const hours = Array.from(
    { length: endHour - startHour },
    (_, i) => startHour + i
  );

  return (
    <div
      data-day-date={date}
      className={`relative border-l border-border ${
        isPast ? "bg-surface-muted/40" : isToday ? "bg-accent-soft/30" : ""
      }`}
      style={{ height }}
    >
      {hours.map((h) => (
        <div
          key={h}
          className="pointer-events-none absolute inset-x-0 border-t border-border/60"
          style={{ top: (h - startHour) * 60 * PX_PER_MIN }}
        />
      ))}

      {isToday && (
        <NowIndicator tz={tz} startHour={startHour} endHour={endHour} />
      )}

      {placements.map(({ item: occ, lane, lanes }) => {
        const { top, height: h } = blockPosition(
          occ.start,
          occ.end,
          tz,
          startHour,
          endHour
        );
        return (
          <ItemCard
            key={occ.key}
            occurrence={occ}
            tz={tz}
            top={top}
            height={h}
            lane={lane}
            lanes={lanes}
            busy={busyKeys.has(occ.key)}
            dragging={draggingKey === occ.key}
            onOpen={onOpen}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
            onDragStart={(item, e) => onDragStart(item, date, e)}
          />
        );
      })}
    </div>
  );
}
