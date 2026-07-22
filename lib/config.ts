/**
 * App-wide configuration and constants.
 * Working hours are user-configurable in the UI; these are the defaults.
 */

export const DEFAULT_TIMEZONE =
  process.env.APP_TIMEZONE && process.env.APP_TIMEZONE.length > 0
    ? process.env.APP_TIMEZONE
    : "Australia/Sydney";

export interface WorkingHours {
  /** Inclusive start hour, 0-23. */
  startHour: number;
  /** Exclusive end hour, 1-24. */
  endHour: number;
}

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  startHour: 6,
  endHour: 22,
};

/** Brand accent (the 10% green of the 60/30/10 palette). */
export const ACCENT_GREEN = "#66AA3C";

/** A small palette the AI can pick from when a colour is not specified. */
export const ITEM_COLORS: Record<string, string> = {
  green: ACCENT_GREEN,
  blue: "#3B82F6",
  orange: "#F97316",
  red: "#EF4444",
  purple: "#8B5CF6",
  teal: "#14B8A6",
  pink: "#EC4899",
  slate: "#64748B",
};

export const DEFAULT_ITEM_COLOR = ACCENT_GREEN;
