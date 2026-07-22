/** ER diagram as SVG so entity/field names are never clipped. */
function Entity({
  x,
  y,
  w,
  title,
  fields,
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  fields: string[];
}) {
  const row = 20;
  const header = 30;
  const h = header + fields.length * row + 12;
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
      <rect
        x={x}
        y={y}
        width={w}
        height={header}
        fill="#f4f4f5"
        stroke="#18181b"
        strokeWidth="1.5"
      />
      <text
        x={x + w / 2}
        y={y + 20}
        textAnchor="middle"
        fontSize="14"
        fontWeight="600"
        fill="#18181b"
      >
        {title}
      </text>
      {fields.map((field, i) => (
        <text
          key={field}
          x={x + 12}
          y={y + header + 16 + i * row}
          fontSize="13"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          fill="#18181b"
        >
          {field}
        </text>
      ))}
    </g>
  );
}

export default function ErDiagram() {
  return (
    <figure className="my-6 overflow-x-auto rounded-xl border border-border bg-white p-4">
      <svg
        viewBox="0 0 780 460"
        className="mx-auto h-auto w-full max-w-4xl"
        role="img"
        aria-label="Entity relationship diagram"
      >
        <defs>
          <marker
            id="erCrow"
            viewBox="0 0 12 12"
            refX="11"
            refY="6"
            markerWidth="9"
            markerHeight="9"
            orient="auto-start-reverse"
          >
            <path d="M2 2 L11 6 L2 10" fill="none" stroke="#18181b" strokeWidth="1.4" />
          </marker>
        </defs>

        <Entity
          x={280}
          y={20}
          w={220}
          title="USERS"
          fields={[
            "string   id",
            "string   email",
            "datetime createdAt",
          ]}
        />
        <Entity
          x={40}
          y={230}
          w={250}
          title="ITEMS"
          fields={[
            "string  id",
            "string  userId",
            "string  type",
            "string  title",
            "string  color",
            "boolean movable",
            "string  tz",
          ]}
        />
        <Entity
          x={490}
          y={250}
          w={250}
          title="LOGIN_CODES"
          fields={[
            "string   email",
            "string   codeHash",
            "datetime expiresAt",
          ]}
        />

        <g fill="none" stroke="#18181b" strokeWidth="1.4">
          <path d="M340 126 C280 170, 220 200, 165 230" markerEnd="url(#erCrow)" />
          <path d="M430 126 C500 170, 560 210, 600 250" markerEnd="url(#erCrow)" />
        </g>
        <text x="220" y="180" fontSize="13" fill="#3f3f46">
          owns
        </text>
        <text x="520" y="190" fontSize="13" fill="#3f3f46">
          has
        </text>
        <text x="300" y="150" fontSize="11" fill="#71717a">
          1
        </text>
        <text x="175" y="225" fontSize="11" fill="#71717a">
          0..*
        </text>
        <text x="450" y="150" fontSize="11" fill="#71717a">
          1
        </text>
        <text x="580" y="245" fontSize="11" fill="#71717a">
          0..*
        </text>
      </svg>
      <figcaption className="mt-3 text-center text-xs text-muted">
        Figure 4 — Entity relationship diagram
      </figcaption>
    </figure>
  );
}
