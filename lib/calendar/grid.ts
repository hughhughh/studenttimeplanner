import { minutesIntoDay } from "@/lib/calendar/time";

/** Vertical scale of the week grid. */
export const PX_PER_MIN = 0.7;
/** Preferred minimum height when the slot has room. */
export const MIN_BLOCK_PX = 18;
/** Breathing room between consecutive cards in the same lane. */
export const BLOCK_GAP_PX = 2;
/** Snap drag moves to this many minutes. */
export const SNAP_MINUTES = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function bodyHeight(startHour: number, endHour: number): number {
  return (endHour - startHour) * 60 * PX_PER_MIN;
}

/** Pixel top + natural (uncapped) height for a timed block. */
export function blockPosition(
  startIso: string,
  endIso: string,
  tz: string,
  startHour: number,
  endHour: number
): { top: number; height: number } {
  const dayStartMin = startHour * 60;
  const dayEndMin = endHour * 60;
  const s = clamp(minutesIntoDay(startIso, tz), dayStartMin, dayEndMin);
  const e = clamp(minutesIntoDay(endIso, tz), dayStartMin, dayEndMin);
  const top = (s - dayStartMin) * PX_PER_MIN;
  const height = Math.max((e - s) * PX_PER_MIN, 0);
  return { top, height };
}

export function snapMinutes(
  minutes: number,
  step: number = SNAP_MINUTES
): number {
  return Math.round(minutes / step) * step;
}

/** Convert a Y offset inside a day column into minutes-since-midnight. */
export function yToDayMinutes(y: number, startHour: number): number {
  return startHour * 60 + y / PX_PER_MIN;
}

export function dayMinutesToY(minutes: number, startHour: number): number {
  return (minutes - startHour * 60) * PX_PER_MIN;
}

/** Keep a timed block fully inside the visible working-hours window. */
export function clampStartMinutes(
  startMin: number,
  durationMin: number,
  startHour: number,
  endHour: number
): number {
  const dayStart = startHour * 60;
  const dayEnd = endHour * 60;
  const maxStart = Math.max(dayStart, dayEnd - Math.max(durationMin, SNAP_MINUTES));
  return clamp(startMin, dayStart, maxStart);
}

export function minutesToTimeOfDay(totalMin: number): string {
  const h = Math.floor(totalMin / 60) % 24;
  const m = Math.floor(totalMin % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface Interval {
  start: string;
  end: string;
}

/**
 * Greedy lane assignment so overlapping blocks in one day sit side by side
 * instead of stacking on top of each other.
 */
export function assignLanes<T extends Interval>(
  intervals: T[]
): { item: T; lane: number; lanes: number }[] {
  const sorted = [...intervals].sort((a, b) => a.start.localeCompare(b.start));
  const laneEnds: string[] = [];
  const placements = sorted.map((item) => {
    let lane = laneEnds.findIndex((end) => end <= item.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(item.end);
    } else {
      laneEnds[lane] = item.end;
    }
    return { item, lane };
  });
  const lanes = Math.max(1, laneEnds.length);
  return placements.map((p) => ({ ...p, lanes }));
}

export interface DayBlockLayout<T extends Interval> {
  item: T;
  lane: number;
  lanes: number;
  top: number;
  height: number;
}

/**
 * Place day items: true overlaps go side-by-side; consecutive items keep a
 * gap and never paint over the next card (short blocks only grow when free).
 */
export function layoutDayBlocks<T extends Interval>(
  intervals: T[],
  tz: string,
  startHour: number,
  endHour: number
): DayBlockLayout<T>[] {
  const placed = assignLanes(intervals);
  const dayEndY = bodyHeight(startHour, endHour);

  const withGeometry = placed.map((p) => {
    const { top, height: rawHeight } = blockPosition(
      p.item.start,
      p.item.end,
      tz,
      startHour,
      endHour
    );
    return { ...p, top, rawHeight };
  });

  const byLane = new Map<number, typeof withGeometry>();
  for (const entry of withGeometry) {
    const list = byLane.get(entry.lane) ?? [];
    list.push(entry);
    byLane.set(entry.lane, list);
  }

  const heights = new Map<T, number>();
  for (const list of byLane.values()) {
    list.sort((a, b) => a.top - b.top || a.rawHeight - b.rawHeight);
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const nextTop = list[i + 1]?.top ?? dayEndY;
      const room = Math.max(nextTop - cur.top - BLOCK_GAP_PX, 0);
      // Prefer a tappable minimum only when it won't cover the next block.
      const preferred =
        cur.rawHeight < MIN_BLOCK_PX && MIN_BLOCK_PX <= room
          ? MIN_BLOCK_PX
          : cur.rawHeight;
      heights.set(cur.item, Math.min(preferred, room));
    }
  }

  return withGeometry.map((p) => ({
    item: p.item,
    lane: p.lane,
    lanes: p.lanes,
    top: p.top,
    height: heights.get(p.item) ?? p.rawHeight,
  }));
}
