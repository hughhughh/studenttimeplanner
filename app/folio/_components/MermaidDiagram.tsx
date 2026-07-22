"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Renders a Mermaid diagram client-side. Diagrams are assessment folio visuals
 * (storyboard, UML, ER, Gantt) — not part of the planner product UI.
 */
export default function MermaidDiagram({
  chart,
  caption,
}: {
  chart: string;
  caption?: string;
}) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "loose",
        fontFamily: "inherit",
        flowchart: {
          htmlLabels: true,
          curve: "basis",
          padding: 12,
          nodeSpacing: 40,
          rankSpacing: 50,
          wrappingWidth: 140,
        },
        themeVariables: {
          fontSize: "14px",
        },
      });
      if (!ref.current || cancelled) return;
      try {
        const { svg } = await mermaid.render(`mmd-${id}`, chart.trim());
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch (err) {
        if (ref.current) {
          ref.current.innerHTML = `<pre class="text-xs text-red-600 whitespace-pre-wrap">${String(err)}</pre>`;
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  return (
    <figure className="my-6 overflow-x-auto rounded-xl border border-border bg-surface-muted/60 p-4">
      <div ref={ref} className="flex min-h-[8rem] justify-center [&_svg]:max-w-full" />
      {caption ? (
        <figcaption className="mt-3 text-center text-xs text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
