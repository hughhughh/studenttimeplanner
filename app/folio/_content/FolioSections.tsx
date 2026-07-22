import MermaidDiagram from "@/app/folio/_components/MermaidDiagram";
import NesaDfd from "@/app/folio/_components/NesaDfd";
import StoryboardDiagram from "@/app/folio/_components/StoryboardDiagram";
import ClassDiagram from "@/app/folio/_components/ClassDiagram";
import ErDiagram from "@/app/folio/_components/ErDiagram";
import { FolioSection, FolioTable, Pseudo } from "@/app/folio/_components/FolioUi";

export default function FolioSections() {
  return (
    <>
      <FolioSection id="problem" title="Problem definition">
        <p>
          Senior secondary students juggle school, homework, sport, and social
          commitments in the same week. A major reason work does not get done is
          not a lack of intention — it is the friction of starting: deciding what
          to do next, when it fits, and how to recover when a plan slips. Paper
          planners and generic calendar apps still leave that planning burden on
          the student. They require repetitive data entry, do not understand
          fixed school blocks versus movable study, and rarely help when a task
          overruns or is missed.
        </p>
        <p>
          Student Time Planner addresses this need with an AI-assisted week view.
          Students talk to the planner in plain language (“add an hour of English
          tonight”) or upload a photo of their printed school timetable so subject
          blocks appear as fixed, recurring activities. The system treats school
          and sport as immovable by default, marks overdue incomplete tasks
          clearly, and validates every AI change before it is written so the
          calendar stays consistent. The opportunity is a low-friction product
          that students will actually open — a guide for the week, not another
          empty grid to fill by hand.
        </p>
      </FolioSection>

      <FolioSection id="functional" title="Functional requirements">
        <FolioTable
          headers={["ID", "Requirement description", "Priority"]}
          rows={[
            [
              "FR1",
              "Users can sign in with a one-time email code (or demo account) and sign out; sessions are cookie-based.",
              "High",
            ],
            [
              "FR2",
              "Users see a Monday–Sunday week view with working hours, today highlighted, and a live now-indicator.",
              "High",
            ],
            [
              "FR3",
              "Users can create, edit, complete, delete, and reschedule tasks and activities (tasks only are completable).",
              "High",
            ],
            [
              "FR4",
              "Users can edit the calendar via natural language through the command bar (AI proposes validated operations).",
              "High",
            ],
            [
              "FR5",
              "Users can upload a timetable image, review extracted blocks, and confirm before save.",
              "High",
            ],
            [
              "FR6",
              "Recurring items expand into weekly occurrences; exceptions skip dates without orphan duplicates.",
              "High",
            ],
            [
              "FR7",
              "Split-session tasks render as one logical item across multiple time blocks.",
              "Medium",
            ],
            [
              "FR8",
              "Each user’s items are private; queries are scoped to the authenticated user id.",
              "High",
            ],
            [
              "FR9",
              "Overdue incomplete tasks are visually distinct (orange) with a reschedule path.",
              "Medium",
            ],
            [
              "FR10",
              "Project documentation covers planning, design, algorithms, and automated tests.",
              "High",
            ],
          ]}
        />
      </FolioSection>

      <FolioSection id="non-functional" title="Non-functional requirements">
        <FolioTable
          headers={["Category", "Requirement"]}
          rows={[
            [
              "Security",
              "Signed JWT session cookies; one-time login codes; Zod validation on all writes; no cross-user data access; secrets only in environment config.",
            ],
            [
              "Performance",
              "Week expansion happens in memory from fetched items; AI apply is all-or-nothing to avoid half-updated calendars; images processed only on upload.",
            ],
            [
              "Usability",
              "Week-first UI, plain-language command bar, review step for timetable import, consistent accent colour and status colours.",
            ],
            [
              "Accessibility",
              "Semantic structure, keyboard-reachable controls where practical, readable type sizes, colour not the only cue for completed vs overdue.",
            ],
            [
              "Portability",
              "Runs on any laptop with Node.js and npm; dependencies declared in package.json.",
            ],
            [
              "Maintainability",
              "TypeScript modules by concern (auth, calendar, AI, db); single Zod source of truth; automated Vitest suite for calendar core.",
            ],
            [
              "Reliability",
              "Malformed AI output is rejected; immovable activities are not shifted by bulk reschedule unless explicitly requested.",
            ],
          ]}
        />
      </FolioSection>

      <FolioSection id="storyboard" title="Storyboard">
        <p>
          The storyboard is a UML activity diagram of the main student journey.
          Rounded rectangles are actions; diamonds are decisions; filled dots are
          merge points; the solid circle is the start and the bullseye is the
          end. Authentication always reaches <em>Load week view</em> (after an
          email code if needed). From <em>Choose next action</em> the student
          picks AI (validate then all-or-nothing apply, or clarify and retry),
          timetable photo (confirm or cancel), UI edit, or change week (reload).
          Successful AI / photo / UI paths merge, refresh the week, then either
          continue or sign out.
        </p>
        <StoryboardDiagram />
      </FolioSection>

      <FolioSection id="financial" title="Financial feasibility">
        <p>
          The target users are secondary students who need a planner they can
          afford. Existing tools (Google Calendar, Notion, study apps) do not
          combine free school-timetable photo import with validated AI scheduling
          around immovable school blocks. Student Time Planner is designed to run
          on a low ongoing cost so the product can stay free for students, or
          charge a low optional fee that still undercuts typical productivity
          subscriptions.
        </p>
        <FolioTable
          headers={["Cost item", "Initial", "Ongoing", "Notes"]}
          rows={[
            ["Developer time", "See opportunity cost", "$0 cash", "Own labour"],
            [
              "Hosting (Vercel hobby / local)",
              "$0",
              "$0–$20 / month",
              "Local run is enough for demos",
            ],
            [
              "MongoDB Atlas M0",
              "$0",
              "$0 / month",
              "Free tier for early users",
            ],
            [
              "Resend email",
              "$0",
              "$0 / month",
              "Free tier for login codes",
            ],
            [
              "Google Gemini API",
              "$0",
              "$10 / month",
              "Token budget for NL + timetable vision",
            ],
            [
              "Domain name",
              "$23 / year",
              "$23 / year",
              "Custom URL for the live product",
            ],
          ]}
        />
        <p>
          <strong>Funding sources:</strong> own unpaid labour for build time;
          vendor free tiers (Vercel, MongoDB Atlas M0, Resend) for early
          hosting/auth; personal funds for Gemini tokens and the domain. No
          external investors or school budget are required for a class demo or a
          small pilot.
        </p>
        <p>
          <strong>Cash operating cost (steady state):</strong> about{" "}
          <strong>$10/month</strong> for Gemini plus{" "}
          <strong>$23/year</strong> for the domain → roughly{" "}
          <strong>$12/month</strong> all-in (domain averaged). Annual cash burn ≈{" "}
          <strong>$143</strong> (12 × $10 + $23).
        </p>
        <p>
          <strong>Opportunity cost:</strong> at a bakery wage of{" "}
          <strong>$25.50/hour</strong>, about{" "}
          <strong>70 hours</strong> of design and development equals{" "}
          <strong>$1,785</strong> forgone wages. That is the main economic cost
          of producing the software.
        </p>
        <h3 className="font-serif text-lg font-semibold">Break-even analysis</h3>
        <p>
          Monthly cash burn is treated as <strong>$12</strong>. If the product
          stays free for students, break-even in cash terms is already met once
          free-tier limits hold — the remaining question is whether the builder
          accepts the $1,785 labour cost as assessment/portfolio investment.
        </p>
        <p>
          If an optional student subscription is introduced at{" "}
          <strong>$3/month</strong> (well below typical Notion/AI tool pricing):
        </p>
        <FolioTable
          headers={["Paying users", "Monthly revenue", "Vs $12 burn", "Result"]}
          rows={[
            ["4", "$12", "Covers burn", "Cash break-even"],
            ["20", "$60", "+$48", "Tokens + small buffer"],
            ["50", "$150", "+$138", "Room for paid DB if needed"],
            ["200", "$600", "+$588", "Comfortable operating margin"],
          ]}
        />
        <p>
          Break-even users = monthly burn ÷ price = 12 ÷ 3 ={" "}
          <strong>4 paying students</strong>. That is a realistic pilot size for
          one school cohort. Commercial alternatives already exist for generic
          calendars, but not as a free, timetable-photo + validated AI week guide
          aimed at Australian secondary students — so the opportunity remains
          financially feasible for the target user and viable to operate at low
          scale.
        </p>
      </FolioSection>

      <FolioSection id="dfd" title="Dataflow diagram (DFD)">
        <p>
          Level 1 data flow diagram for Student Time Planner. Circles are
          processes, open-sided rectangles are data stores, closed rectangles are
          external entities, and labelled curved arrows show data moving between
          them.
        </p>
        <NesaDfd />
      </FolioSection>

      <FolioSection id="data-dictionary" title="Data dictionary">
        <p>
          Each stored field is listed with its type, display format, sizes,
          purpose, example, and validation rules.
        </p>
        <FolioTable
          headers={[
            "Variable",
            "Data type",
            "Format for display",
            "Size in bytes",
            "Size for display",
            "Description",
            "Example",
            "Validation",
          ]}
          rows={[
            [
              "userId",
              "String",
              "XX..XX",
              "24",
              "24",
              "Primary key identifying the signed-in user (Mongo ObjectId hex or demo id).",
              "demo-user",
              "Required; non-empty",
            ],
            [
              "email",
              "String",
              "XX..XX",
              "64",
              "64",
              "Login email for one-time codes.",
              "sam@school.edu",
              "Valid email; stored lower-case",
            ],
            [
              "itemId",
              "String",
              "XX..XX",
              "24",
              "24",
              "Primary key for a calendar item.",
              "507f1f77bcf86cd799439011",
              "Unique; required",
            ],
            [
              "type",
              "String",
              "XX..XX",
              "8",
              "8",
              "Whether the item is a task or an activity.",
              "task",
              "Must be task or activity",
            ],
            [
              "title",
              "String",
              "XX..XX",
              "200",
              "40",
              "Display name on the calendar card.",
              "English essay",
              "Length 1–200",
            ],
            [
              "color",
              "String",
              "#NNNNNN",
              "7",
              "7",
              "Hex colour for the card.",
              "#66AA3C",
              "Regex ^#[0-9A-Fa-f]{6}$",
            ],
            [
              "movable",
              "Boolean",
              "X",
              "1 bit",
              "1",
              "Whether AI may freely reschedule the item.",
              "N",
              "true/false; activities default false",
            ],
            [
              "segmentStart",
              "Date and Time",
              "YYYY-MM-DD HH:mm",
              "4",
              "16",
              "Start of a one-off time block (ISO stored).",
              "2026-07-22 19:00",
              "Valid datetime with offset",
            ],
            [
              "segmentEnd",
              "Date and Time",
              "YYYY-MM-DD HH:mm",
              "4",
              "16",
              "End of a one-off time block.",
              "2026-07-22 20:00",
              "Must be after segmentStart",
            ],
            [
              "freq",
              "String",
              "XX..XX",
              "8",
              "8",
              "Recurrence frequency.",
              "weekly",
              "daily or weekly",
            ],
            [
              "byWeekday",
              "Array (Integer)",
              "N,N,…",
              "7",
              "13",
              "Luxon weekdays the series repeats on (1=Mon … 7=Sun).",
              "1,2,3,4,5",
              "Each value 1–7; weekly needs ≥1",
            ],
            [
              "timeStart",
              "String",
              "HH:mm",
              "5",
              "5",
              "Local start time for a recurring series.",
              "08:30",
              "Valid HH:mm; before timeEnd",
            ],
            [
              "timeEnd",
              "String",
              "HH:mm",
              "5",
              "5",
              "Local end time for a recurring series.",
              "15:00",
              "Valid HH:mm; after timeStart",
            ],
            [
              "interval",
              "Integer",
              "N",
              "1",
              "1",
              "Week stride (2 = Week A/B fortnight).",
              "2",
              "Integer 1–4 if set",
            ],
            [
              "exceptions",
              "Array (String)",
              "YYYY-MM-DD",
              "10 * n",
              "10",
              "Dates skipped in a recurring series.",
              "2026-07-22",
              "Each entry valid yyyy-MM-dd",
            ],
            [
              "completed",
              "Boolean",
              "X",
              "1 bit",
              "1",
              "Whether a task is done.",
              "Y",
              "Only allowed when type = task",
            ],
            [
              "loginCode",
              "String",
              "NNNNNN",
              "6",
              "6",
              "One-time sign-in code (hashed at rest).",
              "482193",
              "Exactly 6 digits; short TTL",
            ],
          ]}
        />
      </FolioSection>

      <FolioSection id="uml" title="UML class diagram">
        <ClassDiagram />
      </FolioSection>

      <FolioSection id="er" title="ER diagram">
        <p>
          Logical entity–relationship view of the MongoDB collections. Each item
          belongs to one user; login codes are short-lived auth records.
        </p>
        <ErDiagram />
      </FolioSection>

      <FolioSection id="approach" title="Research and selection of development approach">
        <p>
          Choosing how to organise a multi-week software project matters as much
          as choosing a framework. Three common approaches taught in software
          engineering are Waterfall, Agile, and WAgile (a hybrid of Waterfall
          planning with Agile delivery). This section compares them by project
          scale and workflow, cites real-world practice, then justifies the
          approach used for Student Time Planner.
        </p>

        <h3 className="font-serif text-lg font-semibold">Waterfall</h3>
        <p>
          Waterfall sequences requirements → design → implementation → testing →
          deployment as largely one-way stages. Documentation is front-loaded:
          the problem, data model, and interfaces are meant to be “finished”
          before coding begins. Scale-wise, Waterfall historically suits large,
          contractual programmes where change is expensive and the problem is
          relatively stable — defence systems, regulated government platforms,
          and civil-engineering-style software schedules. Workflow-wise, each
          stage has a gate; testers receive a build late; feedback that
          contradicts an early requirement is costly because earlier artefacts
          are treated as locked.
        </p>
        <p>
          A useful case study is the classic UK government and large enterprise
          programmes of the 1990s–2000s that adopted Waterfall-like stage gates
          (and later public inquiries into delayed IT). Those projects were
          large in team size and budget, with many stakeholders and fixed
          contracts. The workflow matched procurement: sign off a specification,
          then build to it. For Student Time Planner, that pattern is a poor fit.
          The product is small in team size (one developer) but uncertain in
          behaviour: Gemini may invent item ids, recurrence edge cases appear
          only when expanding a real week, and timetable photos vary by school.
          Locking a complete design before those discoveries would waste time
          rewriting “finished” documents instead of tightening validation code.
        </p>

        <h3 className="font-serif text-lg font-semibold">Agile</h3>
        <p>
          Agile favours working software every short cycle, continuous backlog
          refinement, and responding to change over comprehensive upfront
          documentation. Scale-wise it thrives in small-to-medium product teams
          that can ship, measure, and pivot — typical SaaS startups and product
          squads. Workflow-wise, stories are sliced vertically (a thin path
          through UI, API, and data), demos replace stage-gate reviews, and
          tests grow alongside features.
        </p>
        <p>
          Industry examples are well known. Spotify’s squad model popularised
          autonomous teams owning a slice of the product with frequent releases.
          Many modern web products (from early Dropbox/Slack-style startups to
          continuous-delivery SaaS firms) use sprint or kanban loops so customer
          feedback arrives while the design is still malleable. For this
          planner, Agile’s strengths matched the technical risk: ship auth, then
          a week view, then AI operations, then timetable import — each slice
          usable. The weakness is documentary: pure Agile can leave DFDs,
          algorithms, and requirement tables thin even when the app works. For a
          Year 12 Software Engineering folio, that weakness matters — markers
          need evidence of planning and design, not only commits.
        </p>

        <h3 className="font-serif text-lg font-semibold">WAgile</h3>
        <p>
          WAgile deliberately combines both. A short Waterfall-style front end
          fixes the problem statement, major functional/non-functional
          requirements, architecture boundaries, and milestones. Delivery then
          follows Agile sprints that implement and revise features against that
          spine. Scale-wise, WAgile targets the middle band: projects too complex
          for “code first, document never,” but too uncertain for a full
          Waterfall freeze. Workflow-wise it maps to a fixed school delivery
          window with Gantt milestones (initiation, core build, AI, polish,
          documentation) while still allowing daily coding loops and
          retrospective fixes.
        </p>
        <p>
          Hybrids like this appear in industry whenever regulated or assessed
          work must meet a deadline yet still absorb discovery — for example
          product teams inside banks that keep an architecture decision record
          and release train, or student/industry projects that must submit
          design packs alongside demos. The comparison on scale is therefore:
          Waterfall for large stable contracts; Agile for continuous product
          evolution with light ceremony; WAgile for small teams with a hard
          deadline and a required design artefact set. Student Time Planner —
          one developer, feature-rich surface (auth, calendar math, LLM tooling,
          image import), fixed Term 3 submission — sits squarely in the WAgile
          band.
        </p>

        <h3 className="font-serif text-lg font-semibold">
          Selected approach: WAgile
        </h3>
        <p>
          On scale: one developer, one product, roughly three weeks of intensive
          build time inside a school term. On workflow: a written spine first
          (problem, FRs/NFRs, data rules), then short implement–test–adjust
          loops for each vertical slice. That combination is exactly what WAgile
          describes, and it is why Waterfall or Agile alone would have been
          weaker choices for this assessment context.
        </p>
        <p>
          Upfront, the product overview locked non-negotiable rules: activities
          immovable by default, tasks only completable, validate before write,
          Australia/Sydney time, and week-first UX. Those decisions acted as the
          Waterfall spine so later coding did not reinvent the product concept
          every day. Delivery then proceeded in vertical Agile slices: MongoDB
          item documents → week expansion and UI → passwordless auth → Gemini
          operations pipeline → timetable review → automated tests and this
          folio. When Gemini returned messy JSON or invented ids, the design
          adapted by tightening Zod schemas and an all-or-nothing apply step
          rather than rewriting a frozen Waterfall design pack. When a duration
          update failed in real use (“Nothing to update on that item”), the
          response was a small Agile loop: reproduce, extend{" "}
          <code>updateItem</code>, add a regression test, update the folio —
          without abandoning the overall milestone plan.
        </p>
        <p>
          In short, Waterfall alone would have delayed learning about AI and
          recurrence until too late; Agile alone would have under-documented the
          system for assessment and future maintenance. WAgile provided a
          documented spine with room to learn — the strongest justification for
          this project’s scale and workflow.
        </p>
      </FolioSection>

      <FolioSection id="gantt" title="Project management — Gantt chart">
        <p>
          Planned phases with dependencies. Calendar and AI work overlapped;
          documentation and automated tests concentrated near the end of the
          build.
        </p>
        <MermaidDiagram
          caption="Figure 5 — Gantt chart of planned schedule"
          chart={`
gantt
  title Student Time Planner schedule
  dateFormat  YYYY-MM-DD
  axisFormat  %d %b
  section Init
  Problem and overview           :a1, 2026-06-30, 7d
  Repo and stack setup           :a2, after a1, 3d
  section Design
  Data model and requirements    :b1, 2026-07-05, 5d
  Week-view storyboard           :b2, after b1, 3d
  section Build
  Items and expansion            :c1, 2026-07-08, 7d
  Week view UI                   :c2, after c1, 5d
  Auth email codes               :c3, 2026-07-12, 5d
  section AI
  Gemini ops pipeline            :d1, 2026-07-15, 6d
  Timetable image review         :d2, after d1, 4d
  section Close
  Automated test suite           :e1, 2026-07-21, 2d
  Folio documentation            :e2, 2026-07-21, 3d
  Packaging and hand-off         :e3, 2026-07-23, 2d
`}
        />
        <p>
          Critical path: items model → expansion → week UI → AI apply. Auth can
          proceed in parallel once the data layer exists. Folio and tests depend
          on a stable domain model so expected outputs can be asserted.
        </p>
      </FolioSection>

      <FolioSection id="diary" title="Project diary">
        <FolioTable
          headers={["Date", "Description", "Challenges / milestones"]}
          rows={[
            [
              "30-06-26",
              "Created the Next.js repository (commit 2fac498). Drafted the project overview: week view, AI command bar, timetable photo import, immovable school blocks.",
              "Milestone: repository created. Decision: TypeScript + Next.js + MongoDB (teacher-approved stack).",
            ],
            [
              "02-07-26",
              "Wrote domain rules in the overview (tasks vs activities, validate-before-write, Australia/Sydney). Sketched FR/NFR list for the folio spine.",
              "WAgile spine started: problem and constraints locked before deep coding.",
            ],
            [
              "05-07-26",
              "Chose MongoDB document shape for Item / Segment / Recurrence. Added Zod schemas as the single validation source.",
              "Decision: document store fits flexible recurrence, exceptions, and overrides better than a rigid SQL layout for this prototype.",
            ],
            [
              "08-07-26",
              "Implemented expandWeek / expandItem: weekday series, exceptions, fortnightly interval, split sessions.",
              "Challenge: split sessions must share one logical card — solved with shared item id + segment keys.",
            ],
            [
              "10-07-26",
              "Built week grid UI: day columns, working-hour scaling, now-indicator, complete checkbox, delete, item modal.",
              "Milestone: first usable vertical slice (data → visible week).",
            ],
            [
              "12-07-26",
              "Added passwordless auth: Resend email codes, jose JWT cookie, proxy gate, demo login for offline demos.",
              "Challenge: email optional in development — codes logged to console when RESEND_API_KEY unset.",
            ],
            [
              "15-07-26",
              "Wired Gemini command bar: prompt context, operation schema, apply planner.",
              "Challenge: model hallucinating item ids and half-valid batches — introduced full validation before any write.",
            ],
            [
              "17-07-26",
              "Hardened AI apply: immovable enforcement, all-or-nothing batches, clarification path when ops are empty.",
              "Decision: fail closed on bad AI output rather than partial calendar corruption.",
            ],
            [
              "19-07-26",
              "Timetable image route + TimetableReview confirm-before-save creating fixed weekly activities.",
              "Milestone: photo → review → immovable week path works. Adapted plan to keep human review mandatory.",
            ],
            [
              "21-07-26",
              "Grew Vitest suite for recurrence, status, grid, cycle, Zod, and AI schemas. Started public folio site structure.",
              "Challenge: keeping tests free of API keys so the teacher can run npm test offline.",
            ],
            [
              "22-07-26",
              "Fixed duration updates on existing items (minutes / end time). Logged regression case 12.1. Expanded folio (activity diagram, approach, finance, diary) and AI apply integration tests.",
              "Milestone: npm test green including integration apply path; folio content aligned to marking criteria.",
            ],
          ]}
        />
      </FolioSection>

      <FolioSection id="ethics" title="Social, ethical and stakeholder considerations">
        <p>
          Building a student planner is not only a technical problem. The people
          who touch the system — students, families, schools, and anyone marking
          or hosting the product — have different needs and risks. This section
          expands those considerations so design choices stay accountable to the
          problem we set out to solve: helping students organise real weeks
          without creating new harm.
        </p>
        <h3 className="font-serif text-lg font-semibold">Students as primary stakeholders</h3>
        <p>
          Students are the people whose homework titles, school subjects, and
          personal notes appear on the calendar. That data can reveal academic
          struggle, medical appointments, or family commitments. The product
          therefore isolates every query by authenticated user id, never stores
          passwords (one-time email codes only), and keeps API keys out of the
          repository. Students should be able to trust that opening the planner
          does not silently share their week with classmates or the wider
          internet.
        </p>
        <p>
          There is also a wellbeing angle. An aggressive “optimising” scheduler
          could pack every free minute with study and increase stress. Student
          Time Planner is deliberately a guide, not a taskmaster: fixed school
          and sport stay put unless the student asks to move them, and overdue
          work is highlighted so it can be rescheduled rather than ignored or
          shamed.
        </p>
        <h3 className="font-serif text-lg font-semibold">Families and schools</h3>
        <p>
          Parents and teachers may want visibility into a student’s workload, but
          this version of the product does not expose shared dashboards. That is
          an ethical boundary as much as a feature gap: without clear consent
          flows, “helpful” sharing becomes surveillance. If collaboration were
          added later, it would need explicit invitations, least-privilege roles,
          and audit of who saw what.
        </p>
        <h3 className="font-serif text-lg font-semibold">Ethical use of AI</h3>
        <p>
          Gemini can misread a blurry timetable, invent subject names, or propose
          times that collide with school. Treating model output as ground truth
          would be unsafe. Mitigations baked into the design include: a human
          review step before timetable blocks are saved; Zod validation of every
          AI operation before any database write; all-or-nothing apply so a bad
          batch cannot half-update the week; and a hard rule that immovable
          activities are not shifted when the model is merely “making room” for
          study. The student remains responsible for their schedule; the AI is an
          assistant that must earn trust operation by operation.
        </p>
        <h3 className="font-serif text-lg font-semibold">Inclusion and accessibility</h3>
        <p>
          Colour alone must not be the only signal for overdue versus completed
          work — labels and actions accompany status colours. The week view is
          intended for both phone and laptop so students without a dedicated
          computer can still plan. Future work should deepen screen-reader
          labelling, focus order, and keyboard paths through the command bar and
          modals.
        </p>
        <h3 className="font-serif text-lg font-semibold">Operators and maintainers</h3>
        <p>
          Anyone running the stack (including a teacher or friend trying the demo)
          needs a path that does not require production email credentials —
          hence console-printed codes and a demo account. Automated tests
          document expected calendar behaviour so regressions like “Nothing to
          update on that item” for a duration change are caught before they
          confuse users again.
        </p>
      </FolioSection>

      <FolioSection id="algorithm" title="Algorithm solution">
        <p>
          These algorithms describe how the product works end-to-end, not a
          single helper function. The <strong>mainline</strong> is what happens
          when a student opens and uses the planner. Algorithms{" "}
          <strong>A</strong>, <strong>B</strong>, and <strong>C</strong> are the
          three critical paths inside that mainline: building the week view,
          applying natural-language changes safely, and importing a timetable
          photo. Pseudocode uses capital keywords, paired structures
          (BEGIN/END, IF/ENDIF, FOR/NEXT), and indentation.
        </p>

        <h3 className="font-serif text-lg font-semibold">
          Mainline — using Student Time Planner
        </h3>
        <p className="text-sm text-muted">
          Overall control flow of the software solution from sign-in to an
          updated calendar.
        </p>
        <Pseudo>
{`BEGIN UsePlanner
  AuthenticateStudent
  LoadWeekView
  REPEAT
    Get student action
    CASEWHERE action evaluates to
      talk to planner: HandleAiRequest
      upload timetable: HandleTimetableImport
      complete or delete item: UpdateItemDirectly
      edit item in modal: UpdateItemDirectly
      change week: LoadWeekView
      OTHERWISE: ignore
    END CASE
    Refresh week view
  UNTIL student signs out
END UsePlanner

BEGIN LoadWeekView
  dates = Monday to Sunday for selected week
  items = read items for this student from database
  occurrences = ExpandWeek (items, dates, now)
  Display occurrences on day columns
END LoadWeekView`}
        </Pseudo>

        <h3 className="mt-6 font-serif text-lg font-semibold">
          A. Expand week occurrences
        </h3>
        <p>
          <strong>What this is:</strong> how stored calendar data becomes the
          week the student sees. One-off blocks, recurring school series,
          skipped days, and overdue/completed status are all resolved here
          before anything is drawn.
        </p>
        <Pseudo>
{`BEGIN ExpandWeek (items, weekDates, now)
  occurrences = empty list
  FOR each item IN items
    ExpandItem (item, weekDates, now, occurrences)
  NEXT item
  Sort occurrences by start ascending
END ExpandWeek

BEGIN ExpandItem (item, weekDates, now, occurrences)
  IF item has recurrence THEN
    ExpandRecurring (item, weekDates, now, occurrences)
  ELSE
    ExpandSingle (item, weekDates, now, occurrences)
  ENDIF
END ExpandItem

BEGIN ExpandRecurring (item, weekDates, now, occurrences)
  FOR each date IN weekDates
    IF date IN item.exceptions THEN
      CONTINUE
    ENDIF
    IF date < recurrence.startDate THEN
      CONTINUE
    ENDIF
    IF recurrence.endDate exists AND date > recurrence.endDate THEN
      CONTINUE
    ENDIF
    IF weekday(date) not in recurrence.byWeekday THEN
      CONTINUE
    ENDIF
    IF interval > 1 AND week not on stride THEN
      CONTINUE
    ENDIF
    Apply overrides for date
    status = ComputeStatus (item.type, completed, end, now)
    APPEND occurrence to occurrences
  NEXT date
END ExpandRecurring

BEGIN ComputeStatus (type, completed, end, now)
  IF type <> task THEN
    RETURN upcoming
  ENDIF
  IF completed = true THEN
    RETURN done
  ENDIF
  IF end < now THEN
    RETURN overdue
  ELSE
    RETURN upcoming
  ENDIF
END ComputeStatus`}
        </Pseudo>

        <h3 className="mt-6 font-serif text-lg font-semibold">
          B. Apply AI operations (all-or-nothing)
        </h3>
        <p>
          <strong>What this is:</strong> how the command bar turns a student’s
          message into real calendar changes. The model may propose several
          operations; the server validates every one first, then either writes
          the whole batch or writes nothing — so the week never ends up
          half-updated.
        </p>
        <Pseudo>
{`BEGIN HandleAiRequest
  message = student text from command bar
  response = AskGemini (message, current items, week context)
  result = ApplyAi (userId, response, context)
  IF result needs clarification THEN
    Show clarification to student
  ELSE IF result failed THEN
    Show error
  ELSE
    Show summary
  ENDIF
END HandleAiRequest

BEGIN ApplyAi (userId, response, context)
  ops = response.operations
  IF clarification exists AND ops is empty THEN
    RETURN ask user
  ENDIF
  plan = empty list
  FOR each op IN ops
    ValidateOperation (op)
    IF validation failed THEN
      APPEND error
    ELSE
      APPEND action to plan
    ENDIF
  NEXT op
  IF any error exists THEN
    RETURN error with no writes
  ENDIF
  FOR each action IN plan
    Execute action for userId
  NEXT action
  IF any write failed THEN
    RETURN error
  ELSE
    RETURN success with summary
  ENDIF
END ApplyAi

BEGIN ValidateOperation (op)
  CASEWHERE op.type evaluates to
    createItem: check item schema and duplicates
    updateItem: check item exists; allow title, colour, notes, duration
    moveItem: check movable or explicit
    deleteItem: check item exists
    skipOccurrence: check recurrence and date
    skipRange: check startDate and endDate
    completeItem: check type = task
    bulkShift: check itemIds and minutes
    OTHERWISE: reject unsupported type
  END CASE
END ValidateOperation`}
        </Pseudo>

        <h3 className="mt-6 font-serif text-lg font-semibold">
          C. Timetable photo import
        </h3>
        <p>
          <strong>What this is:</strong> how a photographed school timetable
          becomes fixed weekly activities — only after the student reviews and
          confirms the draft, so a bad image cannot silently invent a full week.
        </p>
        <Pseudo>
{`BEGIN HandleTimetableImport
  image = uploaded timetable photo
  draft = AskGeminiVision (image)
  Show TimetableReview with draft subject blocks
  IF student cancels THEN
    RETURN without saving
  ENDIF
  confirmed = blocks student kept or edited
  FOR each block IN confirmed
    Create recurring activity (fixed, movable = false)
  NEXT block
  Refresh week view
END HandleTimetableImport`}
        </Pseudo>
      </FolioSection>

      <FolioSection id="versions" title="Version sequence / code backup">
        <p>
          Source control is <strong>Git</strong>. The initial scaffold is
          committed locally; feature work was developed as dated milestones
          (table below) with the working tree backed up via the project folder
          and prepared for a submission zip / remote push. Each row records what
          changed and when, matching the project diary.
        </p>
        <FolioTable
          headers={["Version", "Date / time", "Commit / backup note"]}
          rows={[
            [
              "v0.1 Scaffold",
              "30-06-26 11:28",
              "2fac498 — Initial commit from Create Next App",
            ],
            [
              "v0.2 Domain model",
              "05-07-26",
              "Checkpoint — Item/Segment/Recurrence types + Zod item schemas (lib/types, lib/validation)",
            ],
            [
              "v0.3 Calendar core",
              "08-07-26",
              "Checkpoint — expandWeek, exceptions, split sessions, fortnightly interval",
            ],
            [
              "v0.4 Week UI",
              "10-07-26",
              "Checkpoint — DayColumn, NowIndicator, ItemCard, ItemModal week grid",
            ],
            [
              "v0.5 Auth",
              "12-07-26",
              "Checkpoint — email codes, jose session cookie, proxy gate, demo login",
            ],
            [
              "v0.6 AI pipeline",
              "17-07-26",
              "Checkpoint — Gemini ops, Zod validation, all-or-nothing apply, command bar",
            ],
            [
              "v0.7 Timetable import",
              "19-07-26",
              "Checkpoint — image extract API + TimetableReview confirm-before-save",
            ],
            [
              "v0.8 Tests + folio",
              "22-07-26",
              "Checkpoint — Vitest unit + AI apply integration; public /folio; duration updateItem fix",
            ],
          ]}
        />
        <p>
          Backup procedure: keep the Git history; export a zip of the repository
          for Schoolbox; do not commit secrets (<code>.env.local</code> stays
          local). Before final hand-off, batch-commit remaining checkpoints so
          the teacher can inspect history on their laptop.
        </p>
      </FolioSection>

      <FolioSection id="prototyping" title="Prototyping sequence">
        <p>
          Prototyping moved from typed domain models to vertical UI slices rather
          than disposable throwaway screens.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Backend / data prototype:</strong> Mongo item documents with
            segments vs recurrence; seed script builds a realistic demo week.
          </li>
          <li>
            <strong>Week view prototype:</strong> seven day columns, working-hour
            scaling, now-indicator, task checkbox and activity styling.
          </li>
          <li>
            <strong>Auth prototype:</strong> login form with code entry and demo
            path.
          </li>
          <li>
            <strong>AI prototype:</strong> command bar → JSON operations →
            validated apply; clarification messages when input is ambiguous.
          </li>
          <li>
            <strong>Timetable prototype:</strong> upload → draft blocks → review
            table → confirm creates immovable weekly activities.
          </li>
        </ol>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              title: "Week view",
              body: "Primary planner surface with day columns and command bar.",
            },
            {
              title: "Login",
              body: "Email code + demo CTA at /login.",
            },
            {
              title: "Command bar",
              body: "Natural-language entry under the week grid.",
            },
            {
              title: "Timetable review",
              body: "Confirm-before-save after image upload.",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="rounded-xl border border-dashed border-border bg-surface-muted/50 p-4"
            >
              <p className="text-sm font-semibold">{card.title}</p>
              <p className="mt-1 text-xs text-muted">{card.body}</p>
              <div className="mt-3 flex h-28 items-center justify-center rounded-lg bg-white text-xs text-muted">
                Screenshot slot
              </div>
            </div>
          ))}
        </div>
      </FolioSection>

      <FolioSection id="testing" title="Automated testing, optimisation & evaluation">
        <p>
          Automated tests prove the calendar core and AI apply pipeline behave as
          specified. Fixtures act as premade calendar items. Unit suites expand
          them for a frozen “now” and assert occurrences, statuses, grid
          geometry, and Zod shapes. Integration suites drive{" "}
          <code>applyAiResponse</code> with mocked persistence to prove
          validate→write behaviour (including all-or-nothing rejection). No
          manual steps and no API keys are required for <code>npm test</code>.
        </p>
        <h3 className="font-serif text-lg font-semibold">How to run</h3>
        <Pseudo>{`npm install
npm test`}</Pseudo>
        <p>
          <strong>Result to record for evidence:</strong> the suite reports all
          tests passed across unit and integration files (100% of the automated
          suite). Example output shape:
        </p>
        <Pseudo>{`Test Files  8 passed (8)
     Tests  35 passed (35)`}</Pseudo>
        <p>
          Use <code>npm run test:watch</code> during development.{" "}
          <code>npm test</code> runs once and exits (suitable for demos).
        </p>
        <h3 className="font-serif text-lg font-semibold">
          Unit testing coverage
        </h3>
        <FolioTable
          headers={["Suite", "Tests", "What is tested"]}
          rows={[
            [
              "tests/calendar/recurrence.test.ts",
              "6",
              "Weekly school series, exceptions, overrides, split sessions, fortnightly interval",
            ],
            [
              "tests/calendar/status.test.ts",
              "4",
              "Overdue / done / upcoming; activities not completable",
            ],
            [
              "tests/calendar/grid.test.ts",
              "4",
              "blockPosition heights; overlapping lane assignment",
            ],
            [
              "tests/calendar/cycle.test.ts",
              "3",
              "Day 1–10 → weekday + Week A/B; fortnightly recurrence helper",
            ],
            [
              "tests/validation/item.test.ts",
              "6",
              "Zod accepts valid creates; rejects illegal shapes",
            ],
            [
              "tests/ai/operations.test.ts",
              "5",
              "AI response/operation schema rejects malformed ops",
            ],
            [
              "tests/ai/updateDuration.test.ts",
              "2",
              "Duration update on an existing item; empty update still rejected",
            ],
          ]}
        />
        <h3 className="font-serif text-lg font-semibold">
          Integration testing coverage
        </h3>
        <p>
          Integration tests sit above pure schema checks: they run the AI apply
          module end-to-end with the database layer mocked, so create / update /
          delete / reject paths exercise the real planning logic without needing
          MongoDB or Gemini.
        </p>
        <FolioTable
          headers={["Suite", "Tests", "What is tested"]}
          rows={[
            [
              "tests/ai/applyIntegration.test.ts",
              "5",
              "Valid create writes; mixed valid+invalid batch writes nothing; immovable school not bulk-shifted; delete; clarification with empty ops",
            ],
            [
              "tests/ai/updateDuration.test.ts",
              "(shared)",
              "Also integration-style: applyAiResponse → updateItem patch for duration resize",
            ],
          ]}
        />
        <h3 className="font-serif text-lg font-semibold">
          Sample expected vs actual
        </h3>
        <FolioTable
          headers={["Test case", "Input (fixture)", "Expected", "Actual"]}
          rows={[
            [
              "Weekday school expansion",
              "Recurring Mon–Fri 08:30–15:00",
              "5 occurrences in a Mon–Sun week",
              "Pass (unit)",
            ],
            [
              "Skip exception",
              "Same series + exception on Wednesday",
              "4 occurrences; Wed absent",
              "Pass (unit)",
            ],
            [
              "Overdue task",
              "Yesterday’s incomplete task; now = Wed noon",
              "status = overdue",
              "Pass (unit)",
            ],
            [
              "Duration update",
              "Essay 1 Aug 16:00–17:00; minutes=240",
              "End becomes 20:00 (4 hours)",
              "Pass (integration)",
            ],
            [
              "All-or-nothing batch",
              "Valid create + update missing id",
              "ok=false; no DB writes",
              "Pass (integration)",
            ],
            [
              "Invalid item",
              "Both segments and recurrence set",
              "Zod failure",
              "Pass (unit)",
            ],
          ]}
        />
        <h3 className="font-serif text-lg font-semibold">Optimisation</h3>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Validate AI output before any database write; fail closed on bad data.
          </li>
          <li>
            Expand occurrences in memory for the visible week only — not the
            entire series history.
          </li>
          <li>
            Clamp grid positions to working hours so off-hours blocks do not
            break layout.
          </li>
          <li>
            Reject unknown item ids early so Gemini hallucinations never touch
            storage.
          </li>
        </ul>
        <h3 className="font-serif text-lg font-semibold">
          Feedback analysis and response
        </h3>
        <p>
          Manual AI prompts are logged in{" "}
          <code>docs/calendarQueryTestCases.md</code>. Section 12 is a
          regression log of real failed prompts. Example:
        </p>
        <FolioTable
          headers={["Feedback / failure", "Analysis", "Response"]}
          rows={[
            [
              "“make … on 1 August be like 4 hours” → “Nothing to update on that item.”",
              "Model sent updateItem with duration fields; apply only accepted title/colour/notes.",
              "Extended updateItem to accept minutes/timeEnd; added updateDuration + integration tests; documented case 12.1.",
            ],
            [
              "Model invents item ids or returns mixed good/bad ops",
              "Partial writes would corrupt the week.",
              "All-or-nothing apply + id existence checks; covered by applyIntegration tests.",
            ],
            [
              "Blurry timetable photos invent subjects",
              "Vision model is not ground truth.",
              "Mandatory TimetableReview confirm step; cancel writes nothing.",
            ],
          ]}
        />
        <h3 className="font-serif text-lg font-semibold">Evaluation</h3>
        <p>
          Against the functional requirements: FR1–FR9 are implemented in the
          running app; FR10 is this folio. Automated unit and integration tests
          give regression evidence for recurrence, status, validation, duration
          updates, and safe AI apply (FR3, FR6, FR8, FR9). Remaining risks
          include Gemini variability on poor timetable photos — mitigated by the
          review UI and Zod layer — and free-tier email limits in production,
          mitigated by the demo login path for marking.
        </p>
      </FolioSection>
    </>
  );
}
