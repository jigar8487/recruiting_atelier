"use client";

/**
 * Inline SVG diagram of the agentic recruitment workflow.
 * Clean top-to-bottom flow — no crossing connectors:
 *   INPUTS  →  SUPERVISOR  →  SPECIALISTS  →  OUTPUT
 *                                                ↓
 *                                         SHARED INFRA (glossary, below)
 */
export function WorkflowDiagram() {
  return (
    <figure className="my-2">
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 1100 760"
          xmlns="http://www.w3.org/2000/svg"
          role="img"
          aria-labelledby="workflow-title workflow-desc"
          className="block min-w-[820px] w-full text-ink"
        >
          <title id="workflow-title">The agentic recruitment workflow</title>
          <desc id="workflow-desc">
            Inputs feed a Supervisor (Meera) who plans, then four named
            specialists — Anaya, Diya, Tara, Riya — carry out screen, score,
            shortlist, and notify. A ranked shortlist plus a draft email
            leaves over SSE. The shared infrastructure (Tool Registry,
            Knowledge Base, LLM Factory, MCP Client) sits below the flow.
          </desc>

          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
            </marker>
            <marker
              id="arrow-ember"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="#F4991A" />
            </marker>
          </defs>

          {/* ============ ROW 1 — INPUTS ============ */}
          <Eyebrow x={60} y={22}>INPUTS</Eyebrow>
          <Box x={60} y={36} w={220} h={64} label="Job description" sub=".pdf / .docx / .txt → KB" />
          <Box x={310} y={36} w={220} h={64} label="Resumes (CVs)" sub="dropped on /run" />
          <Box x={560} y={36} w={220} h={64} label="Provider" sub="anthropic · openai · …" />

          {/* arrows from inputs down to supervisor */}
          <Arrow x1={170} y1={100} x2={400} y2={184} />
          <Arrow x1={420} y1={100} x2={500} y2={184} />
          <Arrow x1={670} y1={100} x2={620} y2={184} />

          {/* ============ ROW 2 — SUPERVISOR ============ */}
          <Eyebrow x={550} y={150} anchor="middle">SUPERVISOR</Eyebrow>
          <rect
            x="60"
            y="184"
            width="980"
            height="84"
            fill="#F2EAD3"
            stroke="#344F1F"
            strokeWidth="1"
          />
          <text
            x="550"
            y="215"
            textAnchor="middle"
            fontFamily="var(--font-display), Source Serif 4, serif"
            fontSize="24"
            fill="currentColor"
          >
            Meera{" "}
            <tspan fontStyle="italic" fillOpacity="0.7" fontSize="17">
              — the Supervisor
            </tspan>
          </text>
          <text
            x="550"
            y="238"
            textAnchor="middle"
            fontFamily="var(--font-display), Source Serif 4, serif"
            fontSize="13"
            fontStyle="italic"
            fill="currentColor"
            opacity="0.7"
          >
            plans → routes → observes → decides
          </text>
          <text
            x="550"
            y="257"
            textAnchor="middle"
            fontFamily="var(--font-mono), JetBrains Mono, ui-monospace"
            fontSize="10"
            letterSpacing="1.2"
            fill="#F4991A"
          >
            REACT LOOP · think → act → observe · max_iterations = 10
          </text>

          {/* arrow down from supervisor to specialists row */}
          <Arrow x1={550} y1={268} x2={550} y2={314} />

          {/* ============ ROW 3 — SPECIALISTS (5 across, Kavya runs first) ============ */}
          <Eyebrow x={60} y={302}>FIVE SPECIALISTS · KAVYA RUNS FIRST</Eyebrow>

          <AgentBox x={60} y={316} num="00" person="KAVYA" role="Vetter" verb="catches duplicates" preflight />
          <AgentBox x={270} y={316} num="01" person="ANAYA" role="Screener" verb="filters the field" />
          <AgentBox x={480} y={316} num="02" person="DIYA" role="Scorer" verb="weighs each match" />
          <AgentBox x={690} y={316} num="03" person="TARA" role="Shortlister" verb="picks the top N" />
          <AgentBox x={900} y={316} num="04" person="RIYA" role="Notifier" verb="drafts the dispatch" />

          {/* horizontal arrows between specialists at row midline (y=358) */}
          <Arrow x1={250} y1={358} x2={270} y2={358} />
          <Arrow x1={460} y1={358} x2={480} y2={358} />
          <Arrow x1={670} y1={358} x2={690} y2={358} />
          <Arrow x1={880} y1={358} x2={900} y2={358} />

          {/* arrow down from last specialist to output */}
          <Arrow x1={995} y1={400} x2={995} y2={456} />

          {/* ============ ROW 4 — OUTPUT ============ */}
          <Eyebrow x={60} y={444}>OUTPUT</Eyebrow>
          <rect
            x="60"
            y="456"
            width="980"
            height="44"
            fill="none"
            stroke="#F4991A"
            strokeWidth="1.25"
          />
          <text
            x="80"
            y="483"
            fontFamily="var(--font-display), Source Serif 4, serif"
            fontStyle="italic"
            fontSize="16"
            fill="#F4991A"
          >
            Ranked shortlist
          </text>
          <text
            x="305"
            y="483"
            fontFamily="var(--font-body), Inter Tight, system-ui"
            fontSize="13"
            fill="currentColor"
            opacity="0.8"
          >
            + draft email + run summary (tokens · latency · cost)
          </text>
          <text
            x="1020"
            y="483"
            textAnchor="end"
            fontFamily="var(--font-mono), JetBrains Mono, ui-monospace"
            fontSize="11"
            fill="currentColor"
            opacity="0.6"
          >
            → SSE → /run
          </text>

          {/* ============ ROW 5 — SHARED INFRA (glossary band) ============ */}
          <Eyebrow x={60} y={560}>
            SHARED INFRA · WHAT EACH SPECIALIST REACHES INTO
          </Eyebrow>

          <InfraBox
            x={60}
            y={576}
            label="Tool Registry"
            sub="parse_resume · score_candidate"
            sub2="send_email · schedule_interview"
          />
          <InfraBox
            x={315}
            y={576}
            label="Knowledge Base"
            sub="Chroma · all-MiniLM-L6-v2"
            sub2="ingest · update_text · remove"
          />
          <InfraBox
            x={570}
            y={576}
            label="LLM Factory"
            sub="anthropic · openai · openrouter"
            sub2="nvidia · ollama · fake"
          />
          <InfraBox
            x={825}
            y={576}
            label="MCP Client"
            sub="ats_query · calendar_book"
            sub2="email_send (remote tools)"
          />

          {/* divider rule between OUTPUT and INFRA band — quiet hint that
              what's below is reference material, not part of the linear flow */}
          <line
            x1="60"
            y1="538"
            x2="1040"
            y2="538"
            stroke="currentColor"
            strokeWidth="1"
            strokeOpacity="0.2"
            strokeDasharray="2 6"
          />
        </svg>
      </div>
      <figcaption className="mt-3 font-display text-[13px] italic leading-snug text-ink/65">
        Inputs feed Meera; she plans and routes; her four specialists execute in
        order; a typed shortlist + draft email leaves via SSE. The shared
        infrastructure below is the same registry, knowledge base, LLM factory,
        and (optional) MCP that every agent reaches into.
      </figcaption>
    </figure>
  );
}

/* ---------- helpers ---------- */

function Eyebrow({
  x,
  y,
  anchor,
  children,
}: {
  x: number;
  y: number;
  anchor?: "start" | "middle" | "end";
  children: React.ReactNode;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor ?? "start"}
      fontFamily="var(--font-body), Inter Tight, system-ui"
      fontSize="10.5"
      letterSpacing="2.4"
      fill="currentColor"
      opacity="0.55"
    >
      {children}
    </text>
  );
}

function Box({
  x,
  y,
  w,
  h,
  label,
  sub,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#F9F5F0"
        stroke="#344F1F"
        strokeOpacity="0.6"
        strokeWidth="1"
      />
      <text
        x={x + 14}
        y={y + 26}
        fontFamily="var(--font-display), Source Serif 4, serif"
        fontSize="15"
        fill="currentColor"
      >
        {label}
      </text>
      <text
        x={x + 14}
        y={y + 46}
        fontFamily="var(--font-mono), JetBrains Mono, ui-monospace"
        fontSize="10"
        fill="currentColor"
        opacity="0.6"
      >
        {sub}
      </text>
    </g>
  );
}

function AgentBox({
  x,
  y,
  num,
  person,
  role,
  verb,
  preflight,
}: {
  x: number;
  y: number;
  num: string;
  person: string;
  role: string;
  verb: string;
  preflight?: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={190}
        height={84}
        fill={preflight ? "#F2EAD3" : "#F9F5F0"}
        stroke="#344F1F"
        strokeWidth="1"
        strokeDasharray={preflight ? "3 3" : "0"}
      />
      <text
        x={x + 14}
        y={y + 22}
        fontFamily="var(--font-mono), JetBrains Mono, ui-monospace"
        fontSize="10"
        letterSpacing="2"
        fill="#F4991A"
      >
        {num} · {person}
      </text>
      <text
        x={x + 14}
        y={y + 48}
        fontFamily="var(--font-display), Source Serif 4, serif"
        fontSize="19"
        fill="currentColor"
      >
        {role}
      </text>
      <text
        x={x + 14}
        y={y + 68}
        fontFamily="var(--font-display), Source Serif 4, serif"
        fontStyle="italic"
        fontSize="12.5"
        fill="currentColor"
        opacity="0.65"
      >
        {verb}
      </text>
    </g>
  );
}

function InfraBox({
  x,
  y,
  label,
  sub,
  sub2,
}: {
  x: number;
  y: number;
  label: string;
  sub: string;
  sub2: string;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={230}
        height={104}
        fill="#F2EAD3"
        stroke="#344F1F"
        strokeWidth="1"
      />
      <text
        x={x + 16}
        y={y + 28}
        fontFamily="var(--font-display), Source Serif 4, serif"
        fontSize="17"
        fill="currentColor"
      >
        {label}
      </text>
      <text
        x={x + 16}
        y={y + 56}
        fontFamily="var(--font-mono), JetBrains Mono, ui-monospace"
        fontSize="10"
        fill="currentColor"
        opacity="0.78"
      >
        {sub}
      </text>
      <text
        x={x + 16}
        y={y + 76}
        fontFamily="var(--font-mono), JetBrains Mono, ui-monospace"
        fontSize="10"
        fill="currentColor"
        opacity="0.62"
      >
        {sub2}
      </text>
    </g>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}) {
  return (
    <line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="currentColor"
      strokeWidth="1.1"
      strokeOpacity="0.7"
      markerEnd="url(#arrow)"
    />
  );
}
