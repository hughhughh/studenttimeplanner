import type { Item } from "@/lib/types";
import type { ItemCreateInput } from "@/lib/validation/item";
import {
  createManyItems,
  deleteItem as dbDeleteItem,
  getItem,
  updateItem as dbUpdateItem,
} from "@/lib/db/items";
import type { UndoSnapshot, UndoStep } from "@/lib/ai/undoDetect";

export type { UndoSnapshot, UndoStep } from "@/lib/ai/undoDetect";
export { isUndoRequest, isRedoRequest } from "@/lib/ai/undoDetect";

export function itemToCreateInput(item: Item): ItemCreateInput {
  return {
    type: item.type,
    title: item.title,
    color: item.color,
    movable: item.movable,
    notes: item.notes,
    schedulingRole: item.schedulingRole,
    tz: item.tz,
    segments: item.segments,
    recurrence: item.recurrence,
    exceptions: item.exceptions,
    overrides: item.overrides,
    completed: item.completed,
    completedAt: item.completedAt ?? null,
  };
}

/** Previous values for every key the forward patch will overwrite. */
export function snapshotFields(
  item: Item,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const record = item as unknown as Record<string, unknown>;
  for (const key of Object.keys(patch)) {
    const value = record[key];
    out[key] =
      value === undefined ? null : (structuredClone(value) as unknown);
  }
  return out;
}

export async function applyUndoSnapshot(
  userId: string,
  snapshot: UndoSnapshot,
  opts: { mode?: "undo" | "redo" } = {}
): Promise<{
  ok: boolean;
  summary?: string;
  error?: string;
  applied?: number;
  /** Inverse of what was just applied — client uses this for redo (after undo) or undo (after redo). */
  inverse?: UndoSnapshot;
}> {
  const mode = opts.mode ?? "undo";
  const nothing =
    mode === "redo" ? "Nothing to redo." : "Nothing to undo.";
  if (!snapshot.steps.length) {
    return { ok: false, error: nothing };
  }

  const steps = [...snapshot.steps].reverse();
  const inverseSteps: UndoStep[] = [];
  let applied = 0;

  try {
    for (const step of steps) {
      if (step.kind === "delete") {
        const item = await getItem(userId, step.id);
        if (item) {
          inverseSteps.push({
            kind: "recreate",
            input: itemToCreateInput(item),
          });
        }
        await dbDeleteItem(userId, step.id);
        applied += 1;
      } else if (step.kind === "restore") {
        const item = await getItem(userId, step.id);
        if (item) {
          inverseSteps.push({
            kind: "restore",
            id: step.id,
            patch: snapshotFields(item, step.patch),
          });
        }
        await dbUpdateItem(userId, step.id, step.patch);
        applied += 1;
      } else if (step.kind === "recreate") {
        const created = await createManyItems(userId, [step.input]);
        const item = created[0];
        if (item) {
          inverseSteps.push({ kind: "delete", id: item.id });
        }
        applied += 1;
      }
    }
  } catch {
    return {
      ok: false,
      error:
        mode === "redo"
          ? "Redo failed partway — refresh and check your calendar."
          : "Undo failed partway — refresh and check your calendar.",
      applied,
    };
  }

  const label = snapshot.label ? ` (“${snapshot.label}”)` : "";
  const summary =
    mode === "redo"
      ? `Redid the last change${label} — ${applied} step${applied === 1 ? "" : "s"}.`
      : `Undid the last change${label} — ${applied} reverse step${applied === 1 ? "" : "s"}.`;

  return {
    ok: true,
    summary,
    applied,
    inverse:
      inverseSteps.length > 0
        ? { label: snapshot.label, steps: inverseSteps }
        : undefined,
  };
}
