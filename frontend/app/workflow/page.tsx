import { WorkflowDiagram } from "@/components/WorkflowDiagram";
import { OutwardMark, PageMark } from "@/components/Marks";
import Link from "next/link";

export const metadata = { title: "Workflow · Recruiting Atelier" };

const CAST = [
  { person: "Meera", role: "Supervisor", verb: "plans, routes, decides" },
  { person: "Kavya", role: "Vetter", verb: "catches duplicates (preflight)" },
  { person: "Anaya", role: "Screener", verb: "filters the field" },
  { person: "Diya", role: "Scorer", verb: "weighs each match" },
  { person: "Tara", role: "Shortlister", verb: "picks the top N" },
  { person: "Riya", role: "Notifier", verb: "drafts the dispatch" },
];

const PHASES = [
  {
    num: "0.",
    title: "Vet (preflight)",
    body: (
      <>
        <strong className="text-ember">Kavya</strong> — the Vetter — runs
        BEFORE Meera plans. She SHA-256 hashes each resume&apos;s normalized
        text and checks an email index against a persistent store at{" "}
        <code>./.seen-resumes.json</code>. Any duplicate (same content or
        same email as a prior scan) gets a <code>vet.chunk</code> event with
        the matched id and is filtered out before the main loop. No tokens
        spent re-scoring the same CV.
      </>
    ),
    files: "tools/vet_tools.py · runner.py — _vet_resumes()",
  },
  {
    num: "I.",
    title: "Plan",
    body: (
      <>
        <strong className="text-ember">Meera</strong> — the Supervisor — reads
        the brief and produces a{" "}
        <strong>numbered plan before executing any of it</strong>. The plan is
        a small Pydantic object: ordered steps, each with a stage and a target
        agent. Planning is its own act; it shows up as a{" "}
        <code>think</code> event on the SSE stream.
      </>
    ),
    files: "agents/supervisor_agent.py · runner.py",
  },
  {
    num: "II.",
    title: "Act",
    body: (
      <>
        For each step, Meera delegates to one of her four specialists —{" "}
        <strong className="text-ember">Anaya</strong> the Screener, then{" "}
        <strong className="text-ember">Diya</strong> the Scorer, then{" "}
        <strong className="text-ember">Tara</strong> the Shortlister, then{" "}
        <strong className="text-ember">Riya</strong> the Notifier. They never
        reach across each other; they only see the shared <code>Session</code>{" "}
        and the registry. Tool calls go through{" "}
        <code>registry.call(&quot;name&quot;, …)</code> and never an{" "}
        <code>import</code>.
      </>
    ),
    files: "agents/screener_agent.py · scorer_agent.py · shortlister.py · notifier_agent.py",
  },
  {
    num: "III.",
    title: "Observe",
    body: (
      <>
        Each tool call returns a typed Pydantic result. The guardrail layer
        validates the LLM&apos;s JSON output against the expected schema and
        retries up to 3× if it&apos;s malformed. Successful results land in{" "}
        <code>session.candidates</code> / <code>session.shortlist</code>;
        Meera relays a <code>chunk</code> per candidate over SSE so you can
        watch the work as it happens.
      </>
    ),
    files: "production/schemas.py · production/guardrails.py",
  },
  {
    num: "IV.",
    title: "Decide",
    body: (
      <>
        After each step, Meera asks: is the next plan step ready, or are we
        done? The exit conditions are explicit — Tara&apos;s shortlist is set
        and Riya has dispatched. No conditional reasoning hidden inside the
        LLM; the decision lives in code where you can read it.
      </>
    ),
    files: "runner.py — the while-loop on iterations",
  },
  {
    num: "V.",
    title: "Notify",
    body: (
      <>
        <strong className="text-ember">Riya</strong> composes a hiring-manager
        email from Tara&apos;s shortlist (also validated by Pydantic) and
        calls <code>send_email</code> — mocked in this build, idempotent on
        content. The run completes; a <code>run.complete</code> event ships
        the summary (tokens in/out, cost, latency, span count) and the
        frontend persists the scan to history.
      </>
    ),
    files: "agents/notifier_agent.py · tools/comm_tools.py",
  },
];

const INFRA = [
  {
    label: "Tool Registry",
    tone: "ink",
    body: (
      <>
        Three pieces: a <strong>TOOLS list</strong> (JSON schemas the LLM
        reads), a <strong>TOOL_MAP dict</strong> (name → callable), and{" "}
        <code>registry.register_module(module)</code> to wire them. Every
        agent reaches for tools through this one interface. See{" "}
        <Link
          href="/tools"
          className="border-b border-ember/60 text-ember hover:border-ember"
        >
          the registry chapter
        </Link>
        .
      </>
    ),
  },
  {
    label: "Knowledge Base",
    tone: "ember",
    body: (
      <>
        Chroma <code>EphemeralClient</code> with the local all-MiniLM-L6-v2
        embedder. Job descriptions and interview guides are chunked,
        embedded, and held in memory for the lifetime of the process. RAG
        is injected into agent prompts; nothing about the candidates is
        persisted beyond the shortlist.
      </>
    ),
  },
  {
    label: "LLM Factory",
    tone: "ink",
    body: (
      <>
        One abstract <code>LLMProvider</code>; five concrete adapters
        (Anthropic, OpenAI, OpenRouter, NVIDIA NIM, local Ollama) plus a{" "}
        <code>FakeLLM</code> for offline tests. Swap at runtime from{" "}
        <Link
          href="/settings"
          className="border-b border-ember/60 text-ember hover:border-ember"
        >
          Settings
        </Link>
        ; the agents don&apos;t know the difference.
      </>
    ),
  },
  {
    label: "MCP Client",
    tone: "ember",
    body: (
      <>
        A separate FastAPI JSON-RPC server on <code>:1813</code> exposes
        remote tools (mocked ATS / calendar / email). On startup the MCP
        client registers them through the <em>same</em> ToolRegistry — so
        agents dispatch local and remote tools identically.
      </>
    ),
  },
  {
    label: "Guardrails",
    tone: "ink",
    body: (
      <>
        Every LLM response is parsed into a Pydantic model. If parsing
        fails, the call is retried up to 3× before surfacing an error. No
        free-form strings drift into agent state — only validated objects.
      </>
    ),
  },
  {
    label: "Observability",
    tone: "ember",
    body: (
      <>
        Langfuse traces when <code>LANGFUSE_*</code> env vars are set;
        otherwise an in-memory span tree plus print-fallback. The run
        summary aggregates tokens, latency, and cost per call so you can
        debug a slow agent without leaving the page.
      </>
    ),
  },
];

const TRACE = [
  {
    step: "1",
    actor: "Browser",
    action: "User drops resume.pdf on /run",
    detail: "CVUploader calls POST /api/v1/extract to turn the PDF into plain text.",
  },
  {
    step: "2",
    actor: "Browser",
    action: "POST /api/v1/run",
    detail: "Body: { job_description, resumes: [{candidate_id, text}], top_n }. Returns {run_id}.",
  },
  {
    step: "3",
    actor: "Backend",
    action: "runner.run() spawns Meera",
    detail: "Tool registry eager-loads local tools; MCP client tries to connect; an SSE emit() is wired.",
  },
  {
    step: "4a",
    actor: "Kavya · Vetter",
    action: "registry.call(\"check_duplicate_resume\", …) per CV",
    detail:
      "Emits one `vet.chunk` per resume marked unique or duplicate. Duplicates are filtered out; only unique resumes continue to Meera. A `vet.complete` summarises submitted/unique/duplicate counts.",
  },
  {
    step: "4b",
    actor: "Meera · Supervisor",
    action: "think() → plan: screen → score → shortlist → notify",
    detail: "Emits a `think` event with the plan; sets the first step.",
  },
  {
    step: "5",
    actor: "Anaya · Screener",
    action: "registry.call(\"parse_resume\", …) per candidate",
    detail: "Emits one `screen.chunk` per candidate with pass/fail + reason.",
  },
  {
    step: "6",
    actor: "Diya · Scorer",
    action: "registry.call(\"score_candidate\", …)",
    detail: "Emits `score.chunk` per candidate with a 0–100 score. Deterministic (temperature=0).",
  },
  {
    step: "7",
    actor: "Tara · Shortlister",
    action: "Ranks and slices to top_n",
    detail: "Emits `shortlist.complete` with the final candidate list. Persisted to .chroma-shortlists/.",
  },
  {
    step: "8",
    actor: "Riya · Notifier",
    action: "Drafts email · registry.call(\"send_email\", …)",
    detail: "Emits `notify.complete` with subject + body.",
  },
  {
    step: "9",
    actor: "Backend",
    action: "emits `run.complete`",
    detail: "Summary: tokens in/out, cost, latency, span count.",
  },
  {
    step: "10",
    actor: "Browser",
    action: "RunStream persists to localStorage history",
    detail: "Row appears in the Past scans table on /run.",
  },
];

export default function WorkflowPage() {
  return (
    <div className="space-y-14">
      <header>
        <p className="eyebrow">Chapter II · Reference</p>
        <h1 className="headline mt-2 text-[44px] sm:text-[56px]">
          The <span className="italic">workflow</span>.
        </h1>
        <p className="deck mt-4 max-w-2xl">
          Meet the cast.{" "}
          <span className="font-display not-italic text-ember">Kavya</span>{" "}
          vets the field for duplicates;{" "}
          <span className="font-display not-italic text-ember">Meera</span>{" "}
          plans what remains;{" "}
          <span className="font-display not-italic text-ember">Anaya</span>,{" "}
          <span className="font-display not-italic text-ember">Diya</span>,{" "}
          <span className="font-display not-italic text-ember">Tara</span>, and{" "}
          <span className="font-display not-italic text-ember">Riya</span>{" "}
          carry it out. Below: the loop in one diagram, the phases in
          order, and a worked example from the moment a CV lands.
        </p>
      </header>

      {/* The cast */}
      <section className="space-y-3">
        <div className="border-b border-hairline pb-2">
          <p className="eyebrow">The cast</p>
        </div>
        <ul className="grid gap-px bg-ink/15 sm:grid-cols-3 lg:grid-cols-6">
          {CAST.map((c, idx) => {
            // Index 0 = Meera (LEAD), 1 = Kavya (PREFLIGHT, runs as step 00),
            // 2-5 = Anaya/Diya/Tara/Riya (the four main-loop specialists, 01-04)
            const label =
              idx === 0
                ? "LEAD"
                : idx === 1
                ? "PREFLIGHT · 00"
                : `0${idx - 1}`;
            return (
              <li key={c.person} className="bg-cream p-4">
                <p className="font-mono text-[10px] tracking-[0.22em] text-ink/50">
                  {label}
                </p>
                <p className="mt-2 font-display text-[22px] leading-tight text-ember">
                  {c.person}
                </p>
                <p className="mt-0.5 font-display text-[13px] italic text-ink/65">
                  the {c.role}
                </p>
                <p className="mt-2 text-[12px] leading-snug text-ink/70">
                  {c.verb}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The diagram */}
      <section className="space-y-3">
        <div className="border-b border-hairline pb-2">
          <p className="eyebrow">The loop in one diagram</p>
        </div>
        <div className="card-wheat overflow-hidden p-6">
          <WorkflowDiagram />
        </div>
      </section>

      {/* Five phases */}
      <section className="space-y-6">
        <div className="border-b border-hairline pb-2">
          <p className="eyebrow">Five phases, in order</p>
        </div>
        <ol className="space-y-px bg-ink/15">
          {PHASES.map((p) => (
            <li key={p.num} className="bg-cream p-6">
              <div className="grid items-start gap-6 sm:grid-cols-[120px_1fr]">
                <div>
                  <span className="font-display text-[48px] italic leading-none text-ember">
                    {p.num}
                  </span>
                  <p className="mt-2 font-display text-[22px] leading-tight text-ink">
                    {p.title}
                  </p>
                </div>
                <div>
                  <p className="text-[14.5px] leading-relaxed text-ink/80">
                    {p.body}
                  </p>
                  <p className="mt-3 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.05em] text-ink/55">
                    <PageMark size={12} className="text-ember" />
                    {p.files}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* What sits behind each phase */}
      <section className="space-y-6">
        <div className="border-b border-hairline pb-2">
          <p className="eyebrow">What sits behind each phase</p>
        </div>
        <div className="grid gap-px bg-ink/15 sm:grid-cols-2 lg:grid-cols-3">
          {INFRA.map((i) => (
            <div key={i.label} className="bg-cream p-5">
              <span
                className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                  i.tone === "ember"
                    ? "border-ember bg-ember/10 text-ember"
                    : "border-ink bg-ink/5 text-ink"
                }`}
              >
                {i.label}
              </span>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink/80">
                {i.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* A worked example */}
      <section className="space-y-6">
        <div className="border-b border-hairline pb-2">
          <p className="eyebrow">A worked example — start to finish</p>
        </div>
        <p className="text-[14.5px] leading-relaxed text-ink/80">
          The user drops <code className="font-mono text-[12px]">resume.pdf</code>{" "}
          on <Link href="/run" className="border-b border-ember/60 text-ember hover:border-ember">/run</Link>.
          Here is the exact trace, top to bottom — what the browser does, what
          the backend does, what Meera and the specialists do, and where each
          piece is in the source.
        </p>
        <ol className="border border-hairline">
          {TRACE.map((t, i) => (
            <li
              key={t.step}
              className={`grid grid-cols-[60px_140px_1fr] gap-4 px-5 py-4 ${
                i < TRACE.length - 1 ? "border-b border-hairline" : ""
              }`}
            >
              <div className="font-mono text-[11px] tracking-[0.15em] text-ink/55">
                STEP {t.step}
              </div>
              <div>
                <p className="font-display text-[16px] italic text-ink">
                  {t.actor}
                </p>
              </div>
              <div>
                <p className="font-mono text-[12.5px] text-ink">
                  {t.action}
                </p>
                <p className="mt-1 text-[13px] text-ink/65">{t.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* CTA */}
      <section className="border-t border-hairline pt-8">
        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <p className="eyebrow">When you&apos;re ready</p>
            <p className="mt-2 font-display text-[22px] italic text-ink/80">
              Drop a CV and watch Meera work.
            </p>
          </div>
          <div className="flex flex-wrap items-end justify-start gap-3 sm:justify-end">
            <Link href="/kb" className="btn">
              <PageMark size={12} />
              <span>Build the library</span>
            </Link>
            <Link href="/run" className="btn-primary">
              <span>Begin a run</span>
              <OutwardMark size={11} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
