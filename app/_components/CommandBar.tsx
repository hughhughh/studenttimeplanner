"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CloseIcon, SparkleIcon } from "@/app/_components/icons";
import { isRedoRequest, isUndoRequest } from "@/lib/ai/undoDetect";
import type { UndoSnapshot } from "@/lib/ai/undoDetect";

type Feedback =
  | { kind: "summary"; text: string }
  | { kind: "error"; text: string }
  | null;

/** Sticky clarify chip: prior request + AI question, so short replies still make sense. */
type FollowUp = {
  originalPrompt: string;
  prior: string;
  question: string;
};

const DEMO_ERROR_MESSAGE = "Feature not available on demo mode";

type AiLogEntry = {
  id: string;
  at: string;
  prompt: string;
  reply: string;
  copyText: string;
};

interface Props {
  weekContext: { weekDates: string[]; tz: string; nowIso: string };
}

/** Client abort slightly after two Gemini caps (initial + one repair) + apply. */
const AI_FETCH_TIMEOUT_MS = 25_000;
const MAX_LOG = 30;
const MAX_UNDO = 20;

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function formatReply(data: Record<string, unknown>): string {
  if (typeof data.error === "string" && data.error) return data.error;
  if (typeof data.clarification === "string" && data.clarification) {
    return data.clarification;
  }
  if (typeof data.summary === "string" && data.summary) return data.summary;
  return "(no reply text)";
}

function buildCopyText(prompt: string, data: Record<string, unknown>): string {
  const lines = [
    `Prompt: ${prompt}`,
    `Reply: ${formatReply(data)}`,
    `ok: ${String(data.ok)}`,
  ];
  if (data.applied != null) lines.push(`applied: ${String(data.applied)}`);
  if (data.duplicatesSkipped != null) {
    lines.push(`duplicatesSkipped: ${String(data.duplicatesSkipped)}`);
  }
  if (data.usedFallback) lines.push("usedFallback: true");
  if (data.undid != null) lines.push(`undid: ${String(data.undid)}`);
  if (data.redid != null) lines.push(`redid: ${String(data.redid)}`);
  if (data.model != null) {
    lines.push(`model: ${JSON.stringify(data.model, null, 2)}`);
  }
  if (data.parseError != null) {
    lines.push(`parseError: ${JSON.stringify(data.parseError, null, 2)}`);
  }
  return lines.join("\n");
}

function asUndoSnapshot(value: unknown): UndoSnapshot | null {
  if (!value || typeof value !== "object") return null;
  const snap = value as UndoSnapshot;
  if (!Array.isArray(snap.steps) || snap.steps.length === 0) return null;
  return {
    label: typeof snap.label === "string" ? snap.label : "last change",
    steps: snap.steps,
  };
}

function composeFollowUpText(followUp: FollowUp, reply: string): string {
  const head = followUp.prior.startsWith("Original request:")
    ? followUp.prior
    : `Original request: ${followUp.prior}`;
  return [
    head,
    `Assistant asked: ${followUp.question}`,
    `Student reply: ${reply}`,
  ].join("\n");
}

export default function CommandBar({ weekContext }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [followUp, setFollowUp] = useState<FollowUp | null>(null);
  const [pending, setPending] = useState(false);
  const [log, setLog] = useState<AiLogEntry[]>([]);
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<UndoSnapshot[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const requestId = useRef(0);

  const pushLog = (prompt: string, data: Record<string, unknown>) => {
    const entry: AiLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      at: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      prompt,
      reply: formatReply(data),
      copyText: buildCopyText(prompt, data),
    };
    setLog((prev) => [entry, ...prev].slice(0, MAX_LOG));
  };

  const copyEntry = async (entry: AiLogEntry) => {
    try {
      await navigator.clipboard.writeText(entry.copyText);
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId((id) => (id === entry.id ? null : id)), 1500);
    } catch {
      setFeedback({ kind: "error", text: "Could not copy to clipboard." });
    }
  };

  const dismissFollowUp = () => setFollowUp(null);

  const submit = async () => {
    const value = text.trim();
    if (!value || pending) return;
    const id = ++requestId.current;
    setPending(true);
    setFeedback(null);

    const activeFollowUp = followUp;
    const sentText = activeFollowUp
      ? composeFollowUpText(activeFollowUp, value)
      : value;
    const wantsUndo = !activeFollowUp && isUndoRequest(value);
    const wantsRedo = !activeFollowUp && !wantsUndo && isRedoRequest(value);
    const undoPayload = wantsUndo ? undoStack[0] : undefined;
    const redoPayload = wantsRedo ? redoStack[0] : undefined;

    try {
      const res = await fetchWithTimeout(
        "/api/ai",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: sentText,
            context: weekContext,
            ...(undoPayload ? { undo: undoPayload } : {}),
            ...(redoPayload ? { redo: redoPayload } : {}),
          }),
        },
        AI_FETCH_TIMEOUT_MS
      );
      const data = (await res.json()) as Record<string, unknown>;
      if (id !== requestId.current) return;
      pushLog(sentText, { ...data, ok: data.ok ?? res.ok });

      if (!res.ok || data.ok === false) {
        const clarification =
          typeof data.clarification === "string" && data.clarification
            ? data.clarification
            : null;
        if (clarification) {
          setFollowUp({
            originalPrompt: activeFollowUp?.originalPrompt ?? value,
            prior: sentText,
            question: clarification,
          });
          setText("");
          setFeedback(null);
        } else {
          setFeedback({
            kind: "error",
            text: DEMO_ERROR_MESSAGE,
          });
        }
        return;
      }

      setText("");
      if (typeof data.clarification === "string" && data.clarification) {
        // Undo/redo "nothing to do" messages are status, not a sticky follow-up.
        if (wantsUndo || wantsRedo) {
          setFollowUp(null);
          setFeedback({ kind: "summary", text: data.clarification });
        } else {
          setFollowUp({
            originalPrompt: activeFollowUp?.originalPrompt ?? value,
            prior: sentText,
            question: data.clarification,
          });
          setFeedback(null);
        }
      } else if (typeof data.summary === "string" && data.summary) {
        setFollowUp(null);
        setFeedback({ kind: "summary", text: data.summary });
      } else {
        setFollowUp(null);
        setFeedback(null);
      }

      if (wantsUndo && undoPayload) {
        setUndoStack((prev) => prev.slice(1));
        const redoSnap = asUndoSnapshot(data.redo);
        if (redoSnap) {
          setRedoStack((prev) => [redoSnap, ...prev].slice(0, MAX_UNDO));
        }
      } else if (wantsRedo && redoPayload) {
        setRedoStack((prev) => prev.slice(1));
        const undoSnap = asUndoSnapshot(data.undo);
        if (undoSnap) {
          setUndoStack((prev) => [undoSnap, ...prev].slice(0, MAX_UNDO));
        }
      } else {
        const snap = asUndoSnapshot(data.undo);
        if (snap) {
          setUndoStack((prev) => [snap, ...prev].slice(0, MAX_UNDO));
          // New forward change clears redo history.
          setRedoStack([]);
        }
      }

      router.refresh();
    } catch (err) {
      if (id !== requestId.current) return;
      const timedOut =
        err instanceof DOMException && err.name === "AbortError";
      const message = timedOut
        ? "That took too long — try again in a moment."
        : "Could not reach the planner.";
      setFeedback({ kind: "error", text: DEMO_ERROR_MESSAGE });
      pushLog(sentText, { ok: false, error: message });
    } finally {
      if (id === requestId.current) setPending(false);
    }
  };

  const feedbackColor =
    feedback?.kind === "error" ? "text-overdue" : "text-accent-strong";

  return (
    <div className="w-full">
      {feedback && (
        <div className="mb-2 flex items-start justify-between gap-3 px-1 text-sm">
          <span className={feedbackColor}>{feedback.text}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-xs text-muted hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}

      <div
        className={`overflow-hidden border border-border bg-surface shadow-sm ${
          followUp ? "rounded-2xl" : "rounded-full"
        }`}
      >
        {followUp && (
          <div className="flex items-start gap-2 border-b border-border bg-surface-muted/40 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] text-muted" title={followUp.originalPrompt}>
                Following up on: {followUp.originalPrompt}
              </p>
              <p className="mt-0.5 text-sm text-foreground">{followUp.question}</p>
            </div>
            <button
              type="button"
              onClick={dismissFollowUp}
              disabled={pending}
              className="mt-0.5 rounded-md p-1 text-muted transition hover:bg-black/5 hover:text-foreground disabled:opacity-50"
              aria-label="Dismiss follow-up"
              title="Start a new request instead"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 px-2 py-1.5">
          <SparkleIcon className="ml-2 h-4 w-4 flex-none text-accent" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder={
              followUp ? "answer or add detail…" : "add tasks, edit calendar…"
            }
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm placeholder:text-muted focus:outline-none disabled:opacity-60"
            aria-label={
              followUp
                ? "Reply to the planner follow-up"
                : "Tell the planner what to do"
            }
            disabled={pending}
          />
          <button
            type="button"
            onClick={() => void submit()}
            disabled={pending || !text.trim()}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? "Working…" : "Send"}
          </button>
        </div>
      </div>

      {/* AI past-actions log — hidden for now
      {log.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="px-1 text-[11px] uppercase tracking-wide text-muted">
            AI log · click to copy · clears on refresh
          </p>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {log.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => void copyEntry(entry)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-left transition hover:border-foreground/20 hover:bg-black/[0.02]"
                  title="Click to copy prompt + response"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-xs font-medium text-foreground">
                      {entry.prompt}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">
                      {copiedId === entry.id ? "Copied" : entry.at}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                    {entry.reply}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      */}
    </div>
  );
}
