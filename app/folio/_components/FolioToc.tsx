"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { FOLIO_SECTIONS } from "@/app/folio/_content/toc";

/** Distance from viewport top used to decide the “current” section. */
const SPY_OFFSET_PX = 120;

export default function FolioToc() {
  const [activeId, setActiveId] = useState<string>(FOLIO_SECTIONS[0].id);
  const activeIdRef = useRef(activeId);
  const clickingRef = useRef(false);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const nodes = FOLIO_SECTIONS.map((s) =>
      document.getElementById(s.id)
    ).filter((el): el is HTMLElement => Boolean(el));
    if (nodes.length === 0) return;

    let frame = 0;

    function pickActiveId(): string {
      // Last section whose top has crossed the spy line.
      let current = nodes[0].id;
      for (const node of nodes) {
        const top = node.getBoundingClientRect().top;
        if (top - SPY_OFFSET_PX <= 0) current = node.id;
        else break;
      }
      return current;
    }

    function onScroll() {
      if (clickingRef.current) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = pickActiveId();
        if (next !== activeIdRef.current) setActiveId(next);
      });
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    };
  }, []);

  function onNavClick(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;

    // Freeze spy updates while smooth-scroll finishes so the highlight
    // doesn't flicker through intermediate sections.
    clickingRef.current = true;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
    clickTimerRef.current = setTimeout(() => {
      clickingRef.current = false;
    }, 700);
  }

  return (
    <nav aria-label="Folio contents" className="space-y-1">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
        Contents
      </p>
      <ol className="space-y-1 text-sm">
        {FOLIO_SECTIONS.map((section, i) => {
          const active = section.id === activeId;
          return (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                onClick={(e) => onNavClick(e, section.id)}
                className={`block rounded-md px-2 py-1.5 transition-colors duration-150 ${
                  active
                    ? "bg-accent-soft font-semibold text-foreground"
                    : "text-muted hover:bg-accent-soft/70 hover:text-foreground"
                }`}
                aria-current={active ? "true" : undefined}
              >
                <span
                  className={`mr-2 font-mono text-xs ${
                    active ? "text-accent-strong" : "text-accent-strong/70"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {section.title}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
