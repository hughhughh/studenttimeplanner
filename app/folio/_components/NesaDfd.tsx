/**
 * Level-1 DFD: process circles, open-right data stores,
 * external entity rectangles, curved labelled flows.
 */
export default function NesaDfd() {
  return (
    <figure className="my-6 overflow-x-auto rounded-xl border border-border bg-white p-4">
      <svg
        viewBox="0 0 840 480"
        className="mx-auto h-auto w-full max-w-4xl"
        role="img"
        aria-label="Level 1 data flow diagram for Student Time Planner"
      >
        <defs>
          <marker
            id="dfdArrow"
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

        {/* External entities */}
        <rect x="20" y="210" width="100" height="48" fill="#fff" stroke="#18181b" strokeWidth="1.5" />
        <text x="70" y="239" textAnchor="middle" fontSize="14" fill="#18181b">
          Student
        </text>

        <rect x="720" y="28" width="96" height="44" fill="#fff" stroke="#18181b" strokeWidth="1.5" />
        <text x="768" y="55" textAnchor="middle" fontSize="14" fill="#18181b">
          Resend
        </text>

        <rect x="720" y="400" width="96" height="44" fill="#fff" stroke="#18181b" strokeWidth="1.5" />
        <text x="768" y="427" textAnchor="middle" fontSize="14" fill="#18181b">
          Gemini
        </text>

        {/* Processes */}
        <circle cx="240" cy="88" r="40" fill="#eef5e7" stroke="#18181b" strokeWidth="1.5" />
        <text x="240" y="84" textAnchor="middle" fontSize="12" fill="#18181b">
          P1
        </text>
        <text x="240" y="102" textAnchor="middle" fontSize="12" fill="#18181b">
          Auth
        </text>

        <circle cx="240" cy="234" r="40" fill="#eef5e7" stroke="#18181b" strokeWidth="1.5" />
        <text x="240" y="230" textAnchor="middle" fontSize="12" fill="#18181b">
          P2
        </text>
        <text x="240" y="248" textAnchor="middle" fontSize="12" fill="#18181b">
          AI Cmd
        </text>

        <circle cx="240" cy="380" r="40" fill="#eef5e7" stroke="#18181b" strokeWidth="1.5" />
        <text x="240" y="376" textAnchor="middle" fontSize="12" fill="#18181b">
          P3
        </text>
        <text x="240" y="394" textAnchor="middle" fontSize="12" fill="#18181b">
          Timetable
        </text>

        <circle cx="430" cy="234" r="44" fill="#eef5e7" stroke="#18181b" strokeWidth="1.5" />
        <text x="430" y="230" textAnchor="middle" fontSize="12" fill="#18181b">
          P4
        </text>
        <text x="430" y="248" textAnchor="middle" fontSize="12" fill="#18181b">
          Item Store
        </text>

        {/* Data stores — open on the right */}
        <g stroke="#18181b" strokeWidth="1.75" fill="none">
          <path d="M580 78 H680 M580 78 V118 M580 118 H680" />
          <path d="M580 158 H680 M580 158 V198 M580 198 H680" />
          <path d="M580 270 H680 M580 270 V310 M580 310 H680" />
        </g>
        <text x="630" y="104" textAnchor="middle" fontSize="13" fill="#18181b">
          D1 Users
        </text>
        <text x="630" y="184" textAnchor="middle" fontSize="13" fill="#18181b">
          D2 Codes
        </text>
        <text x="630" y="296" textAnchor="middle" fontSize="13" fill="#18181b">
          D3 Items
        </text>

        {/* Flows */}
        <g fill="none" stroke="#18181b" strokeWidth="1.25" markerEnd="url(#dfdArrow)">
          <path d="M120 220 C160 160, 180 120, 200 100" />
          <path d="M200 76 C150 50, 140 190, 120 215" />
          <path d="M120 234 H200" />
          <path d="M120 258 C155 310, 180 350, 200 370" />
          <path d="M280 68 C450 18, 580 18, 720 42" />
          <path d="M280 95 C400 90, 500 95, 580 98" />
          <path d="M280 110 C390 145, 500 170, 580 178" />
          <path d="M280 220 C330 210, 360 210, 386 220" />
          <path d="M386 248 C350 260, 310 260, 280 248" />
          <path d="M474 234 C520 234, 545 280, 580 290" />
          <path d="M280 400 C450 440, 600 440, 720 430" />
          <path d="M280 355 C400 330, 520 305, 580 295" />
        </g>

        {/* Labels kept clear of nodes */}
        <g fontSize="11" fill="#3f3f46">
          <text x="128" y="150">email / code</text>
          <text x="128" y="68">session</text>
          <text x="130" y="226">NL request</text>
          <text x="118" y="320">timetable photo</text>
          <text x="450" y="32">send code</text>
          <text x="400" y="78">user record</text>
          <text x="390" y="152">store code</text>
          <text x="310" y="205">ops</text>
          <text x="305" y="275">week view</text>
          <text x="500" y="258">CRUD items</text>
          <text x="400" y="340">save blocks</text>
          <text x="450" y="452">image / draft</text>
        </g>
      </svg>
      <figcaption className="mt-3 text-center text-xs text-muted">
        Figure 2 — Level 1 data flow diagram
      </figcaption>
    </figure>
  );
}
