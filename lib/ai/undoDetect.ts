import type { ItemCreateInput } from "@/lib/validation/item";

/** One reverse step for a single applied AI action (session-only on the client). */
export type UndoStep =
  | { kind: "delete"; id: string }
  | { kind: "restore"; id: string; patch: Record<string, unknown> }
  | { kind: "recreate"; input: ItemCreateInput };

export interface UndoSnapshot {
  /** Original student prompt that produced this change. */
  label: string;
  steps: UndoStep[];
}

/** Client-safe undo phrase detection (no DB imports). */
export function isUndoRequest(message: string): boolean {
  const t = message.trim().toLowerCase();
  return (
    /^(please\s+|can you\s+|could you\s+)?undo\b/.test(t) ||
    /\bundo (the )?(last|that|previous) (change|action|edit|command)\b/.test(t) ||
    t === "undo" ||
    t === "undo that" ||
    t === "undo last"
  );
}

/** Client-safe redo phrase detection (no DB imports). */
export function isRedoRequest(message: string): boolean {
  const t = message.trim().toLowerCase();
  return (
    /^(please\s+|can you\s+|could you\s+)?redo\b/.test(t) ||
    /\bredo (the )?(last|that|previous) (change|action|edit|command|undo)\b/.test(
      t
    ) ||
    t === "redo" ||
    t === "redo that" ||
    t === "redo last"
  );
}
