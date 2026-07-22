"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SparkleIcon } from "@/app/_components/icons";

type Feedback =
  | { kind: "summary" | "clarification"; text: string }
  | { kind: "error"; text: string }
  | null;

interface Props {
  weekContext: { weekDates: string[]; tz: string; nowIso: string };
  onTimetableDraft: (draft: unknown) => void;
}

export default function CommandBar({ weekContext, onTimetableDraft }: Props) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const value = text.trim();
    if (!value || pending) return;
    startTransition(async () => {
      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value, context: weekContext }),
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          if (data.clarification) {
            setFeedback({ kind: "clarification", text: data.clarification });
          } else {
            setFeedback({
              kind: "error",
              text: data.error ?? "Something went wrong.",
            });
          }
          return;
        }
        setText("");
        setFeedback(
          data.summary ? { kind: "summary", text: data.summary } : null
        );
        router.refresh();
      } catch {
        setFeedback({ kind: "error", text: "Could not reach the planner." });
      }
    });
  };

  const onPickImage = (file: File | undefined) => {
    if (!file || pending) return;
    startTransition(async () => {
      try {
        const form = new FormData();
        form.append("image", file);
        form.append("context", JSON.stringify(weekContext));
        const res = await fetch("/api/timetable", {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          setFeedback({
            kind: "error",
            text: data.error ?? "Could not read that timetable.",
          });
          return;
        }
        onTimetableDraft(data.draft);
      } catch {
        setFeedback({ kind: "error", text: "Could not upload the image." });
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  };

  const feedbackColor =
    feedback?.kind === "error"
      ? "text-overdue"
      : feedback?.kind === "clarification"
        ? "text-foreground"
        : "text-accent-strong";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center px-4 pb-5">
      <div className="pointer-events-auto w-full max-w-2xl">
        {feedback && (
          <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-2 text-sm shadow-lg">
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
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-2 py-1.5 shadow-lg">
          <SparkleIcon className="ml-2 h-4 w-4 flex-none text-accent" />
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="add tasks, edit calendar…"
            className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-sm placeholder:text-muted focus:outline-none"
            aria-label="Tell the planner what to do"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onPickImage(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="rounded-full px-3 py-1.5 text-xs font-medium text-muted hover:bg-black/5 disabled:opacity-60"
            title="Upload a timetable photo"
          >
            Timetable
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || !text.trim()}
            className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? "…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
