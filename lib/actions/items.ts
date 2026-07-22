"use server";

import { refresh } from "next/cache";
import { verifySession } from "@/lib/auth/dal";
import { deleteItem, getItem, updateItem } from "@/lib/db/items";
import { dateTimeFrom, isValidTimeOfDay } from "@/lib/calendar/time";
import type { OccurrenceOverride, Segment } from "@/lib/types";

/**
 * Server Actions for the manual (backup) editing path: complete, delete,
 * reschedule, and edit details. The AI command path is the primary way to make
 * changes; these keep direct UI edits working too. All actions are scoped to
 * the current user and finish with refresh() so the week view reflects reality.
 */

export interface ToggleCompleteInput {
  itemId: string;
  date: string;
  recurring: boolean;
  completed: boolean;
}

export async function toggleComplete(input: ToggleCompleteInput): Promise<void> {
  const { userId } = await verifySession();
  const item = await getItem(userId, input.itemId);
  if (!item || item.type !== "task") return; // only tasks can be completed

  const completedAt = input.completed ? new Date().toISOString() : null;

  if (input.recurring) {
    const overrides: Record<string, OccurrenceOverride> = {
      ...(item.overrides ?? {}),
    };
    overrides[input.date] = {
      ...(overrides[input.date] ?? {}),
      completed: input.completed,
      completedAt,
    };
    await updateItem(userId, item.id, { overrides });
  } else {
    await updateItem(userId, item.id, {
      completed: input.completed,
      completedAt,
    });
  }
  refresh();
}

export interface DeleteOccurrenceInput {
  itemId: string;
  date: string;
  recurring: boolean;
}

/** Delete a single item, or skip one occurrence of a recurring series. */
export async function deleteOccurrence(
  input: DeleteOccurrenceInput
): Promise<void> {
  const { userId } = await verifySession();
  const item = await getItem(userId, input.itemId);
  if (!item) return;

  if (input.recurring) {
    const exceptions = Array.from(
      new Set([...(item.exceptions ?? []), input.date])
    );
    await updateItem(userId, item.id, { exceptions });
  } else {
    await deleteItem(userId, item.id);
  }
  refresh();
}

export async function deleteSeries(itemId: string): Promise<void> {
  const { userId } = await verifySession();
  await deleteItem(userId, itemId);
  refresh();
}

export type EditScope = "occurrence" | "series";

export interface EditOccurrenceInput {
  itemId: string;
  date: string;
  recurring: boolean;
  segmentIndex?: number;
  scope: EditScope;
  title?: string;
  color?: string;
  notes?: string;
  movable?: boolean;
  timeStart?: string;
  timeEnd?: string;
}

/**
 * Apply an edit from the detail modal. Title/colour/notes/movable edit the
 * item itself; time edits target either the clicked occurrence (an override /
 * the specific segment) or the whole series, depending on scope.
 */
export async function editOccurrence(input: EditOccurrenceInput): Promise<void> {
  const { userId } = await verifySession();
  const item = await getItem(userId, input.itemId);
  if (!item) return;

  const patch: Record<string, unknown> = {};

  if (typeof input.title === "string" && input.title.trim()) {
    patch.title = input.title.trim();
  }
  if (typeof input.color === "string") patch.color = input.color;
  if (typeof input.notes === "string") patch.notes = input.notes;
  if (typeof input.movable === "boolean") patch.movable = input.movable;

  const hasTimeEdit =
    input.timeStart &&
    input.timeEnd &&
    isValidTimeOfDay(input.timeStart) &&
    isValidTimeOfDay(input.timeEnd) &&
    input.timeStart < input.timeEnd;

  if (hasTimeEdit) {
    if (!item.recurrence) {
      const segments: Segment[] = [...(item.segments ?? [])];
      const index = input.segmentIndex ?? 0;
      if (segments[index]) {
        const start = dateTimeFrom(input.date, input.timeStart!, item.tz);
        const end = dateTimeFrom(input.date, input.timeEnd!, item.tz);
        segments[index] = {
          start: start.toISO() ?? segments[index].start,
          end: end.toISO() ?? segments[index].end,
        };
        patch.segments = segments;
      }
    } else if (input.scope === "series") {
      patch.recurrence = {
        ...item.recurrence,
        timeStart: input.timeStart,
        timeEnd: input.timeEnd,
      };
    } else {
      const overrides: Record<string, OccurrenceOverride> = {
        ...(item.overrides ?? {}),
      };
      overrides[input.date] = {
        ...(overrides[input.date] ?? {}),
        timeStart: input.timeStart,
        timeEnd: input.timeEnd,
      };
      patch.overrides = overrides;
    }
  }

  if (Object.keys(patch).length > 0) {
    await updateItem(userId, item.id, patch);
  }
  refresh();
}
