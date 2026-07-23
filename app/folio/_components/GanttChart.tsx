"use client";

import { useMemo } from "react";
import type { GanttDayMark, GanttTask } from "@/app/folio/_content/ganttTasks";
import { GANTT_END, GANTT_START } from "@/app/folio/_content/ganttTasks";
import {
  dayOfMonth,
  eachDate,
  formatDayLabel,
  isWeekend,
  monthSpans,
} from "@/lib/gantt/dates";

const CELL_W = 14;

function markClass(mark: GanttDayMark | undefined): string {
  if (mark === "scheduled") return "bg-amber-400";
  if (mark === "done") return "bg-sky-500";
  if (mark === "both") return "bg-emerald-500";
  return "bg-white";
}

function groupBySection(
  tasks: GanttTask[]
): { section: string; tasks: GanttTask[] }[] {
  const order: string[] = [];
  const map = new Map<string, GanttTask[]>();
  for (const task of tasks) {
    const key = task.section.trim() || "General";
    if (!map.has(key)) {
      map.set(key, []);
      order.push(key);
    }
    map.get(key)!.push(task);
  }
  return order.map((section) => ({ section, tasks: map.get(section)! }));
}

export default function GanttChart({
  tasks,
  caption = "Figure 5 — Planned vs completed schedule (26 Feb – 24 Jul 2026)",
  rangeStart = GANTT_START,
  rangeEnd = GANTT_END,
}: {
  tasks: GanttTask[];
  caption?: string;
  rangeStart?: string;
  rangeEnd?: string;
}) {
  const dates = useMemo(
    () => eachDate(rangeStart, rangeEnd),
    [rangeStart, rangeEnd]
  );
  const spans = useMemo(() => monthSpans(dates), [dates]);
  const groups = useMemo(() => groupBySection(tasks), [tasks]);

  return (
    <figure className="my-6 overflow-hidden rounded-xl border border-border bg-surface-muted/60">
      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-white/80 px-4 py-3 text-xs">
        <span className="font-semibold text-foreground">Legend</span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-4 rounded-sm bg-amber-400" />
          Scheduled
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-4 rounded-sm bg-sky-500" />
          Completed
        </span>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-3 w-4 rounded-sm bg-emerald-500" />
          Scheduled + completed
        </span>
        <span className="ml-auto text-muted">
          {formatDayLabel(rangeStart)} – {formatDayLabel(rangeEnd)}
        </span>
      </div>

      <div className="overflow-x-auto">
        <div
          className="inline-block min-w-full"
          style={{ minWidth: 220 + dates.length * CELL_W }}
        >
          <div className="flex border-b border-border bg-white/70">
            <div className="sticky left-0 z-10 w-55 shrink-0 border-r border-border bg-white px-2 py-1.5 text-[11px] font-semibold text-muted">
              Phase / task
            </div>
            <div className="flex">
              {spans.map((span) => (
                <div
                  key={`${span.label}-${span.startIndex}`}
                  className="border-r border-border/70 text-center text-[10px] font-semibold text-foreground/80"
                  style={{ width: span.dayCount * CELL_W }}
                >
                  {span.label}
                </div>
              ))}
            </div>
          </div>

          <div className="flex border-b border-border bg-white/40">
            <div className="sticky left-0 z-10 w-55 shrink-0 border-r border-border bg-white/95" />
            <div className="flex">
              {dates.map((d) => {
                const dom = dayOfMonth(d);
                const show = dom === 1 || dom % 7 === 0;
                return (
                  <div
                    key={`tick-${d}`}
                    title={formatDayLabel(d)}
                    className={`border-r border-border/40 text-center text-[8px] leading-4 text-muted ${
                      isWeekend(d) ? "bg-zinc-100/80" : ""
                    }`}
                    style={{ width: CELL_W }}
                  >
                    {show ? dom : ""}
                  </div>
                );
              })}
            </div>
          </div>

          {groups.map((group) => (
            <div key={group.section}>
              <div className="flex border-b border-border bg-accent-soft/50">
                <div className="sticky left-0 z-10 w-55 shrink-0 truncate border-r border-border bg-accent-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-accent-strong">
                  {group.section}
                </div>
                <div
                  className="bg-accent-soft/30"
                  style={{ width: dates.length * CELL_W }}
                />
              </div>
              {group.tasks.map((task) => (
                <div
                  key={task.id}
                  className="flex border-b border-border/70 last:border-b-0"
                >
                  <div
                    className="sticky left-0 z-10 w-55 shrink-0 truncate border-r border-border bg-white px-2 py-0.5 text-[11px] text-foreground"
                    title={task.name}
                  >
                    {task.name}
                  </div>
                  <div className="flex">
                    {dates.map((d) => {
                      const mark = task.days[d];
                      return (
                        <div
                          key={`${task.id}-${d}`}
                          title={`${task.name} · ${formatDayLabel(d)}${
                            mark ? ` · ${mark}` : ""
                          }`}
                          className={`h-5 border-r border-b border-border/30 ${
                            mark
                              ? markClass(mark)
                              : isWeekend(d)
                                ? "bg-zinc-50"
                                : "bg-white"
                          }`}
                          style={{ width: CELL_W }}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {caption ? (
        <figcaption className="border-t border-border px-4 py-3 text-center text-xs text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
