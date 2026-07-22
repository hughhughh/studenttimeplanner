import { minutesIntoDay } from "@/lib/calendar/time";

/** Vertical scale of the week grid. */
export const PX_PER_MIN = 1;
/** Minimum rendered height so very short blocks stay tappable. */
export const MIN_BLOCK_PX = 22;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function bodyHeight(startHour: number, endHour: number): number {
  return (endHour - startHour) * 60 * PX_PER_MIN;
}

/** Pixel top/height for a block, clamped into the visible working-hours window. */
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
  const height = Math.max((e - s) * PX_PER_MIN, MIN_BLOCK_PX);
  return { top, height };
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
