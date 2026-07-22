/**
 * UML activity diagram — Student Time Planner journey.
 *
 * Crossing-free design:
 * - Lane order PHOTO | AI | UI | NAV so Cancel can exit left immediately
 * - LEFT rail  = Cancel + Keep-using(Yes)
 * - RIGHT rail = Change-week reload
 * - AI clarify loops on the AI↔UI gutter (right side of AI), not across lanes
 * - Merge dots above targets; coloured decisions / actions restored
 */
export default function StoryboardDiagram() {
  const W = 860;
  const MID = 420;
  const LEFT = 28;
  const RIGHT = 832;

  // PHOTO leftmost so Cancel never crosses another lane
  const L = { photo: 130, ai: 320, ui: 510, nav: 700 } as const;
  const LANE_W = 152;
  const AI_RIGHT = (L.ai + L.ui) / 2; // clarify gutter (no other spines)

  const yOpen = 44;
  const ySigned = 128;
  const yEmail = 186;
  const yLoadMerge = 252;
  const yLoad = 268;
  const yChooseMerge = 322;
  const yChoose = 338;
  const yWhich = 416;
  const yBus = 464;
  const yLane0 = 508;
  const yLaneDec = 618;
  const yLane1 = 688;
  const yMerge = 772;
  const yRefresh = 800;
  const yKeep = 896;
  const yEnd = 1000;

  const Action = ({
    x,
    y,
    w,
    h,
    lines,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    lines: string[];
  }) => {
    const lineH = 15;
    const blockH = lines.length * lineH;
    const startY = y + (h - blockH) / 2 + 12;
    return (
      <g>
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx="11"
          fill="#f4f4f5"
          stroke="#18181b"
          strokeWidth="1.5"
        />
        {lines.map((line, i) => (
          <text
            key={`${line}-${i}`}
            x={x + w / 2}
            y={startY + i * lineH}
            textAnchor="middle"
            fontSize="12.5"
            fontFamily="system-ui, sans-serif"
            fill="#18181b"
          >
            {line}
          </text>
        ))}
      </g>
    );
  };

  const Decision = ({
    cx,
    cy,
    r = 34,
    lines,
  }: {
    cx: number;
    cy: number;
    r?: number;
    lines: string[];
  }) => (
    <g>
      <polygon
        points={`${cx},${cy - r} ${cx + r},${cy} ${cx},${cy + r} ${cx - r},${cy}`}
        fill="#eef5e7"
        stroke="#18181b"
        strokeWidth="1.5"
      />
      {lines.map((line, i) => (
        <text
          key={line}
          x={cx}
          y={cy - ((lines.length - 1) * 13) / 2 + i * 13 + 4}
          textAnchor="middle"
          fontSize="11.5"
          fontFamily="system-ui, sans-serif"
          fontWeight={600}
          fill="#18181b"
        >
          {line}
        </text>
      ))}
    </g>
  );

  const Arrow = ({ d }: { d: string }) => (
    <path
      d={d}
      fill="none"
      stroke="#18181b"
      strokeWidth="1.45"
      strokeLinejoin="round"
      strokeLinecap="round"
      markerEnd="url(#actArrow)"
    />
  );

  const Wire = ({ d }: { d: string }) => (
    <path
      d={d}
      fill="none"
      stroke="#18181b"
      strokeWidth="1.45"
      strokeLinejoin="round"
      strokeLinecap="round"
    />
  );

  const Guard = ({
    x,
    y,
    text,
    anchor = "middle",
  }: {
    x: number;
    y: number;
    text: string;
    anchor?: "start" | "middle" | "end";
  }) => (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize="11"
      fontFamily="system-ui, sans-serif"
      fontWeight={500}
      fill="#3f3f46"
    >
      {text}
    </text>
  );

  const LaneTag = ({ x, text }: { x: number; text: string }) => (
    <text
      x={x}
      y={yBus + 18}
      textAnchor="middle"
      fontSize="11"
      fontFamily="system-ui, sans-serif"
      fontWeight={700}
      letterSpacing="0.06em"
      fill="#3f3f46"
    >
      {text}
    </text>
  );

  const Dot = ({ cx, cy }: { cx: number; cy: number }) => (
    <circle cx={cx} cy={cy} r={3.5} fill="#18181b" />
  );

  // Email sits between LEFT rail and PHOTO so the left rail never hits it
  const emailCx = 200;

  return (
    <figure className="my-6 overflow-x-auto rounded-xl border border-border bg-white p-4">
      <svg
        viewBox={`0 0 ${W} 1030`}
        className="mx-auto h-auto w-full max-w-4xl"
        role="img"
        aria-label="UML activity diagram for Student Time Planner"
      >
        <defs>
          <marker
            id="actArrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6.5"
            markerHeight="6.5"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#18181b" />
          </marker>
        </defs>

        {/* Start → Open → Signed in? */}
        <circle cx={MID} cy={18} r={8} fill="#18181b" />
        <Arrow d={`M${MID} 26 V${yOpen}`} />
        <Action
          x={MID - 78}
          y={yOpen}
          w={156}
          h={36}
          lines={["Open planner"]}
        />
        <Arrow d={`M${MID} ${yOpen + 36} V${ySigned - 34}`} />
        <Decision cx={MID} cy={ySigned} lines={["Signed", "in?"]} />

        {/* No → email (between left rail and PHOTO column) */}
        <Guard x={MID - 48} y={ySigned - 12} text="No" anchor="end" />
        <Arrow d={`M${MID - 34} ${ySigned} H${emailCx} V${yEmail}`} />
        <Action
          x={emailCx - LANE_W / 2}
          y={yEmail}
          w={LANE_W}
          h={38}
          lines={["Enter email code"]}
        />

        {/* Yes + email → load-merge */}
        <Guard x={MID + 14} y={ySigned + 48} text="Yes" anchor="start" />
        <Wire d={`M${MID} ${ySigned + 34} V${yLoadMerge}`} />
        <Wire d={`M${emailCx} ${yEmail + 38} V${yLoadMerge} H${MID}`} />
        <Dot cx={MID} cy={yLoadMerge} />
        <Arrow d={`M${MID} ${yLoadMerge + 3.5} V${yLoad}`} />

        <Action
          x={MID - 90}
          y={yLoad}
          w={180}
          h={38}
          lines={["Load week view"]}
        />

        <Wire d={`M${MID} ${yLoad + 38} V${yChooseMerge}`} />
        <Dot cx={MID} cy={yChooseMerge} />
        <Arrow d={`M${MID} ${yChooseMerge + 3.5} V${yChoose}`} />

        <Action
          x={MID - 100}
          y={yChoose}
          w={200}
          h={38}
          lines={["Choose next action"]}
        />
        <Arrow d={`M${MID} ${yChoose + 38} V${yWhich - 34}`} />
        <Decision cx={MID} cy={yWhich} r={36} lines={["Which", "action?"]} />

        {/* Fan-out */}
        <Wire d={`M${MID} ${yWhich + 36} V${yBus}`} />
        <Wire d={`M${L.photo} ${yBus} H${L.nav}`} />
        <LaneTag x={L.photo} text="PHOTO" />
        <LaneTag x={L.ai} text="AI" />
        <LaneTag x={L.ui} text="UI" />
        <LaneTag x={L.nav} text="NAV" />
        <Arrow d={`M${L.photo} ${yBus} V${yLane0}`} />
        <Arrow d={`M${L.ai} ${yBus} V${yLane0}`} />
        <Arrow d={`M${L.ui} ${yBus} V${yLane0}`} />
        <Arrow d={`M${L.nav} ${yBus} V${yLane0}`} />

        <Action
          x={L.photo - LANE_W / 2}
          y={yLane0}
          w={LANE_W}
          h={46}
          lines={["Upload", "timetable photo"]}
        />
        <Action
          x={L.ai - LANE_W / 2}
          y={yLane0}
          w={LANE_W}
          h={46}
          lines={["Talk via", "command bar"]}
        />
        <Action
          x={L.ui - LANE_W / 2}
          y={yLane0}
          w={LANE_W}
          h={46}
          lines={["Edit / complete", "in UI"]}
        />
        <Action
          x={L.nav - LANE_W / 2}
          y={yLane0}
          w={LANE_W}
          h={38}
          lines={["Change week"]}
        />

        {/* PHOTO */}
        <Arrow d={`M${L.photo} ${yLane0 + 46} V${yLaneDec - 34}`} />
        <Decision cx={L.photo} cy={yLaneDec} lines={["User", "confirms?"]} />
        <Guard x={L.photo + 12} y={yLaneDec + 48} text="Yes" anchor="start" />
        <Arrow d={`M${L.photo} ${yLaneDec + 34} V${yLane1}`} />
        <Action
          x={L.photo - LANE_W / 2}
          y={yLane1}
          w={LANE_W}
          h={46}
          lines={["Save fixed", "weekly blocks"]}
        />
        {/* Cancel → LEFT rail → choose-merge (PHOTO is leftmost: no lane crossings) */}
        <Guard x={L.photo - 40} y={yLaneDec - 2} text="Cancel" anchor="end" />
        <Wire
          d={`M${L.photo - 34} ${yLaneDec} H${LEFT} V${yChooseMerge} H${MID}`}
        />

        {/* AI */}
        <Arrow d={`M${L.ai} ${yLane0 + 46} V${yLaneDec - 34}`} />
        <Decision cx={L.ai} cy={yLaneDec} lines={["Ops", "valid?"]} />
        <Guard x={L.ai + 12} y={yLaneDec + 48} text="Yes" anchor="start" />
        <Arrow d={`M${L.ai} ${yLaneDec + 34} V${yLane1}`} />
        <Action
          x={L.ai - LANE_W / 2}
          y={yLane1}
          w={LANE_W}
          h={46}
          lines={["Apply batch", "all-or-nothing"]}
        />
        {/* Clarify on AI↔UI gutter (right of AI) — does not cross PHOTO or LEFT rail */}
        <Guard x={L.ai + 42} y={yLaneDec - 2} text="No — clarify" anchor="start" />
        <Wire d={`M${L.ai + 34} ${yLaneDec} H${AI_RIGHT} V${yLane0 - 12}`} />
        <Dot cx={L.ai} cy={yLane0 - 12} />
        <Wire d={`M${AI_RIGHT} ${yLane0 - 12} H${L.ai}`} />
        <Arrow d={`M${L.ai} ${yLane0 - 8.5} V${yLane0}`} />

        {/* UI */}
        <Arrow d={`M${L.ui} ${yLane0 + 46} V${yLane1}`} />
        <Action
          x={L.ui - LANE_W / 2}
          y={yLane1}
          w={LANE_W}
          h={40}
          lines={["Write item change"]}
        />

        {/* NAV → RIGHT rail → load-merge (outside fan-out) */}
        <Guard x={L.nav + 10} y={yLane0 + 52} text="Reload week" anchor="start" />
        <Wire
          d={`M${L.nav} ${yLane0 + 38} V${yMerge + 36} H${RIGHT} V${yLoadMerge} H${MID}`}
        />

        {/* Success merge */}
        <Wire d={`M${L.photo} ${yLane1 + 46} V${yMerge}`} />
        <Wire d={`M${L.ai} ${yLane1 + 46} V${yMerge}`} />
        <Wire d={`M${L.ui} ${yLane1 + 40} V${yMerge}`} />
        <Wire d={`M${L.photo} ${yMerge} H${L.ui}`} />
        <Dot cx={MID} cy={yMerge} />
        <Arrow d={`M${MID} ${yMerge + 3.5} V${yRefresh}`} />

        <Action
          x={MID - 100}
          y={yRefresh}
          w={200}
          h={38}
          lines={["Refresh week view"]}
        />
        <Arrow d={`M${MID} ${yRefresh + 38} V${yKeep - 34}`} />

        <Decision cx={MID} cy={yKeep} r={36} lines={["Keep", "using?"]} />

        {/* Keep using → Yes on LEFT rail (outside email + PHOTO) */}
        <Guard x={MID - 48} y={yKeep - 12} text="Yes" anchor="end" />
        <Wire d={`M${MID - 36} ${yKeep} H${LEFT} V${yChooseMerge} H${MID}`} />

        <Guard
          x={MID + 14}
          y={yKeep + 50}
          text="No — sign out"
          anchor="start"
        />
        <Arrow d={`M${MID} ${yKeep + 36} V${yEnd - 14}`} />

        <circle
          cx={MID}
          cy={yEnd}
          r={12}
          fill="none"
          stroke="#18181b"
          strokeWidth="2.2"
        />
        <circle cx={MID} cy={yEnd} r={6} fill="#18181b" />
      </svg>
      <figcaption className="mt-3 text-center text-xs text-muted">
        Figure 1 — UML activity diagram: student journey with decisions and
        branches
      </figcaption>
    </figure>
  );
}
