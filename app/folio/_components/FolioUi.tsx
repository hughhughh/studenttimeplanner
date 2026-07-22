import type { ReactNode } from "react";

export function FolioSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 border-b border-border py-10 last:border-b-0"
    >
      <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <div className="folio-prose mt-4 space-y-4 text-[15px] leading-relaxed text-foreground/90">
        {children}
      </div>
    </section>
  );
}

export function FolioTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead className="bg-surface-muted">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="border-b border-border px-3 py-2 font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="align-top odd:bg-white even:bg-surface-muted/40">
              {row.map((cell, j) => (
                <td key={j} className="border-b border-border px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pseudo({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl border border-border bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-100">
      {children.trim()}
    </pre>
  );
}
