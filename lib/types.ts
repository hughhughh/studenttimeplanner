/**
 * Domain types for Student Time Planner.
 *
 * One stored item == one calendar card, even when it spans multiple time
 * blocks (split sessions) or repeats every week (recurring series).
 */

export type ItemType = "task" | "activity";

/** Luxon weekday numbering: 1 = Monday ... 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RecurrenceFreq = "daily" | "weekly";

/** Hints for the planner when placing tasks around fixed blocks. */
export type SchedulingRole = "study_period";

/** A concrete block of time for a non-recurring item. */
export interface Segment {
  /** ISO datetime (with offset) for the block start. */
  start: string;
  /** ISO datetime (with offset) for the block end. */
  end: string;
}

export interface Recurrence {
  freq: RecurrenceFreq;
  /** Days the item repeats on (1-7, Mon-Sun). For `daily` this is all weekdays. */
  byWeekday: number[];
  /** Local time of day, "HH:mm". */
  timeStart: string;
  /** Local time of day, "HH:mm". */
  timeEnd: string;
  /** First date the series is active, "yyyy-MM-dd". */
  startDate: string;
  /** Last date the series is active (inclusive), "yyyy-MM-dd". Open-ended if absent. */
  endDate?: string;
  /**
   * Repeat every N weeks (default 1). Use 2 for Week A / Week B fortnightly timetables.
   * `startDate` anchors which weeks the series falls on.
   */
  interval?: number;
}

/** Per-occurrence edits keyed by occurrence date ("yyyy-MM-dd"). */
export interface OccurrenceOverride {
  title?: string;
  color?: string;
  timeStart?: string;
  timeEnd?: string;
  notes?: string;
  /** Only meaningful for tasks. */
  completed?: boolean;
  completedAt?: string | null;
}

/** Item as stored (Mongo `_id` rendered as a string `id` for the app/client). */
export interface Item {
  id: string;
  userId: string;
  type: ItemType;
  title: string;
  color: string;
  /** Activities default to false (immovable). */
  movable: boolean;
  notes?: string;
  /** When set, guides task scheduling (e.g. study_period = prefer for homework today). */
  schedulingRole?: SchedulingRole;
  tz: string;

  /** Present for single (non-recurring) items. */
  segments?: Segment[];

  /** Present for recurring items. */
  recurrence?: Recurrence;
  exceptions?: string[];
  overrides?: Record<string, OccurrenceOverride>;

  /** Completion for single tasks (recurring task completion lives in overrides). */
  completed?: boolean;
  completedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export type OccurrenceStatus = "upcoming" | "overdue" | "done";

/**
 * A single rendered block in the week grid. A split single-item produces one
 * occurrence per segment (same `itemId`, different `segmentIndex`); a recurring
 * item produces one per active day.
 */
export interface Occurrence {
  itemId: string;
  /** Stable key for React + AI references: `itemId`, `itemId#segmentIndex`, or `itemId@date`. */
  key: string;
  type: ItemType;
  title: string;
  color: string;
  movable: boolean;
  notes?: string;
  /** Whether this came from a recurring series (drives the repeat icon). */
  recurring: boolean;
  /** Occurrence date "yyyy-MM-dd" (the day column it belongs to). */
  date: string;
  /** ISO datetime start/end of this specific block. */
  start: string;
  end: string;
  segmentIndex?: number;
  completable: boolean;
  completed: boolean;
  status: OccurrenceStatus;
}
