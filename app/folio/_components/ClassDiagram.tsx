/** UML class diagram drawn as SVG so attribute names are fully visible. */
function ClassBox({
  x,
  y,
  w,
  title,
  lines,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  lines: string[];
}) {
  const row = 18;
  const header = 28;
  const h = header + lines.length * row + 10;
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#fff"
        stroke="#18181b"
        strokeWidth="1.5"
      />
      <line
        x1={x}
        y1={y + header}
        x2={x + w}
        y2={y + header}
        stroke="#18181b"
        strokeWidth="1.25"
      />
      <text
        x={x + w / 2}
        y={y + 19}
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        fill="#18181b"
      >
        {title}
      </text>
      {lines.map((line, i) => (
        <text
          key={line}
          x={x + 10}
          y={y + header + 16 + i * row}
          fontSize="12"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#18181b"
        >
          {line}
        </text>
      ))}
    </g>
  );
}

export default function ClassDiagram() {
  return (
    <figure className="my-6 overflow-x-auto rounded-xl border border-border bg-white p-4">
      <svg
        viewBox="0 0 920 520"
        className="mx-auto h-auto w-full max-w-5xl"
        role="img"
        aria-label="UML class diagram"
      >
        <defs>
          <marker
            id="classArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#18181b" />
          </marker>
        </defs>

        <ClassBox
          x={340}
          y={16}
          w={200}
          title="User"
          lines={["+ String id", "+ String email", "+ DateTime createdAt"]}
        />
        <ClassBox
          x={620}
          y={16}
          w={220}
          title="LoginCode"
          lines={[
            "+ String email",
            "+ String codeHash",
            "+ DateTime expiresAt",
          ]}
        />
        <ClassBox
          x={300}
          y={160}
          w={240}
          title="Item"
          lines={[
            "+ String id",
            "+ String userId",
            "+ String type",
            "+ String title",
            "+ String color",
            "+ Boolean movable",
            "+ String tz",
          ]}
        />
        <ClassBox
          x={24}
          y={360}
          w={200}
          title="Segment"
          lines={["+ DateTime start", "+ DateTime end"]}
        />
        <ClassBox
          x={280}
          y={360}
          w={240}
          title="Recurrence"
          lines={[
            "+ String freq",
            "+ Int[] byWeekday",
            "+ String timeStart",
            "+ String timeEnd",
            "+ String startDate",
            "+ Int interval",
          ]}
        />
        <ClassBox
          x={580}
          y={360}
          w={220}
          title="Occurrence"
          lines={[
            "+ String key",
            "+ String date",
            "+ DateTime start",
            "+ DateTime end",
            "+ String status",
          ]}
        />

        <g fill="none" stroke="#18181b" strokeWidth="1.3" markerEnd="url(#classArrow)">
          <path d="M540 50 H620" />
          <path d="M440 108 V160" />
          <path d="M320 300 C200 320, 160 340, 124 360" />
          <path d="M420 316 V360" />
          <path d="M520 300 C600 320, 650 340, 680 360" strokeDasharray="6 4" />
        </g>

        <g fontSize="12" fill="#3f3f46">
          <text x="560" y="42">1</text>
          <text x="600" y="42">*</text>
          <text x="575" y="34">requests</text>
          <text x="450" y="140">1</text>
          <text x="450" y="155">*</text>
          <text x="455" y="148">owns</text>
          <text x="180" y="340">has 1..*</text>
          <text x="430" y="350">has 0..1</text>
          <text x="640" y="340">expandsTo</text>
        </g>
      </svg>
      <figcaption className="mt-3 text-center text-xs text-muted">
        Figure 3 — Class diagram (attributes and relationships)
      </figcaption>
    </figure>
  );
}
