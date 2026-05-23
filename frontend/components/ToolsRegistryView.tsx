"use client";

import { useEffect, useState } from "react";
import { listTools } from "@/lib/api";
import type { ToolEntry } from "@/lib/types";

export function ToolsRegistryView() {
  const [tools, setTools] = useState<ToolEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listTools()
      .then(setTools)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="space-y-14">
      <Anatomy />
      <Pattern />
      <LiveRegistry tools={tools} error={error} />
    </div>
  );
}

/* ============================================================
 * Section I — Anatomy of a Tool Schema
 * ============================================================ */

// Pulled verbatim from backend/tools/resume_tools.py — keep this synced if
// the real schema changes.
const ANATOMY_TOOL = `# backend/tools/resume_tools.py
TOOLS = [
  {
    "name": "parse_resume",
    "description":
      "Extract structured fields (name, email,
       years of experience, skills, education)
       from raw resume text. Use this BEFORE
       scoring or shortlisting — it produces
       typed candidate data the rest of the
       pipeline relies on.",
    "input_schema": {
      "type": "object",
      "properties": {
        "resume_text": {
          "type": "string",
          "description":
            "Full plain-text resume content."
        },
        "candidate_id": {
          "type": "string",
          "description":
            "Stable id (e.g. file stem).
             Generated if omitted."
        }
      },
      "required": ["resume_text"]
    }
  },
  # ...score_candidate next
]`;

const ANATOMY_NOTES = [
  {
    chip: "name",
    accent: "ink",
    body: (
      <>
        <code>&quot;parse_resume&quot;</code> — must match the key in{" "}
        <code>TOOL_MAP</code> exactly. The Screener calls it via{" "}
        <code>registry.call(&quot;parse_resume&quot;, …)</code> in{" "}
        <code>agents/screener_agent.py</code>.
      </>
    ),
  },
  {
    chip: "description",
    accent: "ember",
    body: (
      <>
        <em className="italic">The most important field.</em> The model reads
        this to decide <strong>when</strong> to reach for the tool. Ours says
        explicitly <em>&ldquo;Use this BEFORE scoring or shortlisting&rdquo;</em>
        {" "}— that&apos;s how we sequence the pipeline without hard-coding it.
      </>
    ),
  },
  {
    chip: "input_schema",
    accent: "ink",
    body: (
      <>
        Hand-written JSON Schema with a description on{" "}
        <strong>every</strong> property. The model uses each one to decide
        what content to put into that slot. <code>resume_text</code> gets the
        full document, <code>candidate_id</code> gets the file stem.
      </>
    ),
  },
  {
    chip: "required",
    accent: "ember",
    body: (
      <>
        Only <code>resume_text</code> is mandatory. <code>candidate_id</code>{" "}
        is optional — if the agent omits it,{" "}
        <code>parse_resume</code> mints one with <code>uuid.uuid4()</code>.
      </>
    ),
  },
];

function Anatomy() {
  return (
    <section className="space-y-6">
      <div className="border-b border-hairline pb-2">
        <p className="eyebrow">I. Anatomy of a tool schema</p>
        <h2 className="mt-2 font-display text-[28px] italic leading-tight text-ink">
          Every tool has four required parts.
        </h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr]">
        <CodeBlock code={ANATOMY_TOOL} highlight={anatomyHighlight} />

        <ol className="space-y-4">
          {ANATOMY_NOTES.map((n, idx) => (
            <li key={n.chip} className="flex gap-4 border-l border-hairline pl-4">
              <span className="font-mono text-[10px] tracking-[0.22em] text-ink/40">
                0{idx + 1}
              </span>
              <div className="flex-1">
                <span
                  className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                    n.accent === "ember"
                      ? "border-ember bg-ember/10 text-ember"
                      : "border-ink bg-ink/5 text-ink"
                  }`}
                >
                  {n.chip}
                </span>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink/80">
                  {n.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Tokens to highlight in the anatomy code block — quoted exact matches. */
const anatomyHighlight: HighlightRule[] = [
  { match: /"name"/g, className: "text-ink font-semibold" },
  { match: /"description"/g, className: "text-ember font-semibold" },
  { match: /"input_schema"/g, className: "text-ink font-semibold" },
  { match: /"required"/g, className: "text-ember font-semibold" },
  { match: /^#.*$/gm, className: "text-ink/55 italic" },
  { match: /"parse_resume"/g, className: "text-ember" },
];

/* ============================================================
 * Section II — Registry Pattern
 * ============================================================ */

// Pulled verbatim from backend/tools/resume_tools.py and registry.py.
const PATTERN_SNIPPET = `# backend/tools/resume_tools.py
# ── TOOLS list (what the LLM sees) ──────────────────────────
TOOLS = [
  { "name": "parse_resume",    "description": "...", "input_schema": {...} },
  { "name": "score_candidate", "description": "...", "input_schema": {...} },
]

# ── Tool functions (the real work) ──────────────────────────
def parse_resume(resume_text, candidate_id=None) -> ResumeFields: ...
def score_candidate(resume_text, jd_text, candidate_id=None) -> int: ...

# ── TOOL_MAP (name → function) ──────────────────────────────
TOOL_MAP = {
  "parse_resume":    parse_resume,
  "score_candidate": score_candidate,
}


# backend/tools/registry.py
# Walks TOOLS + TOOL_MAP from any tool module and wires them in.
class ToolRegistry:
    def register_module(self, module):
        for spec in module.TOOLS:
            name = spec["name"]
            self._tools[name] = ToolEntry(
                name=name,
                func=module.TOOL_MAP[name],   # ← dispatch
                description=spec["description"],
                input_schema=spec["input_schema"],
            )


# backend/runner.py — wiring at run-time
from tools import comm_tools, resume_tools
registry = ToolRegistry.singleton()
registry.register_module(resume_tools)
registry.register_module(comm_tools)

# Now every agent calls tools through the registry:
# fields = registry.call("parse_resume", resume_text=..., candidate_id=...)`;

function Pattern() {
  return (
    <section className="space-y-6">
      <div className="border-b border-hairline pb-2">
        <p className="eyebrow">II. The registry pattern</p>
        <h2 className="mt-2 font-display text-[28px] italic leading-tight text-ink">
          Decouple <span className="not-italic">definitions</span> from{" "}
          <span className="not-italic">execution</span>.
        </h2>
      </div>

      <div className="grid gap-px bg-ink/15 sm:grid-cols-3">
        <PatternCell
          tag="TOOLS list"
          tone="ink"
          title="What the model reads"
          body="JSON Schemas at the top of resume_tools.py and comm_tools.py. The agent ships these with every chat call — descriptions and required arrays are how the LLM decides when to call and what to pass."
        />
        <PatternCell
          tag="TOOL_MAP dict"
          tone="ember"
          title="The dispatcher"
          body="name → function, declared after the implementations in each tools module. registry.register_module() walks TOOLS and looks each name up in TOOL_MAP to wire dispatch."
        />
        <PatternCell
          tag="Tool function"
          tone="ink"
          title="The real work"
          body="Pure Python: parse_resume, score_candidate, send_email, schedule_interview. Validates inputs, calls the LLM via the factory, returns a typed Pydantic result. The model never sees inside."
        />
      </div>

      <CodeBlock code={PATTERN_SNIPPET} highlight={patternHighlight} />
    </section>
  );
}

function PatternCell({
  tag,
  tone,
  title,
  body,
}: {
  tag: string;
  tone: "ink" | "ember";
  title: string;
  body: string;
}) {
  return (
    <div className="bg-cream p-6">
      <span
        className={`inline-block border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
          tone === "ember"
            ? "border-ember bg-ember/10 text-ember"
            : "border-ink bg-ink/5 text-ink"
        }`}
      >
        {tag}
      </span>
      <p className="mt-3 font-display text-[20px] italic leading-tight text-ink">
        {title}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink/75">{body}</p>
    </div>
  );
}

const patternHighlight: HighlightRule[] = [
  { match: /^#.*$/gm, className: "text-ink/45 italic" },
  { match: /"(name|description|input_schema)"/g, className: "text-ink font-semibold" },
  { match: /\b(TOOL_MAP|TOOLS)\b/g, className: "text-ember font-semibold" },
  {
    match: /"(parse_resume|score_candidate|send_email|schedule_interview)"/g,
    className: "text-ember",
  },
  {
    match: /\bdef\b|\bclass\b|\bfor\b|\bin\b|\bfrom\b|\bimport\b|\breturn\b/g,
    className: "text-ember/80",
  },
  { match: /\bToolRegistry\b|\bToolEntry\b/g, className: "text-ink font-semibold" },
];

/* ============================================================
 * Section III — Live registry
 * ============================================================ */

function LiveRegistry({
  tools,
  error,
}: {
  tools: ToolEntry[] | null;
  error: string | null;
}) {
  return (
    <section className="space-y-6">
      <div className="border-b border-hairline pb-2">
        <p className="eyebrow">III. Live registry</p>
        <h2 className="mt-2 font-display text-[28px] italic leading-tight text-ink">
          What this backend exposes right now.
        </h2>
      </div>

      {error && (
        <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          {error}
        </div>
      )}

      {tools === null ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
          · loading registry ·
        </p>
      ) : tools.length === 0 ? (
        <p className="font-display text-[20px] italic text-ink/60">
          No tools registered.
        </p>
      ) : (
        <>
          <RegistrySummary tools={tools} />
          <ul className="space-y-px bg-ink/15">
            {tools.map((t) => (
              <li key={t.name} className="bg-cream">
                <ToolCard tool={t} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RegistrySummary({ tools }: { tools: ToolEntry[] }) {
  const local = tools.filter((t) => t.source === "local").length;
  const mcp = tools.filter((t) => t.source === "mcp").length;
  return (
    <dl className="grid grid-cols-3 gap-px bg-ink/15">
      <Stat label="Total" value={String(tools.length)} />
      <Stat label="Local" value={String(local)} />
      <Stat label="MCP" value={String(mcp)} accent />
    </dl>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-cream px-5 py-4">
      <dt className="eyebrow">{label}</dt>
      <dd
        className={`mt-1 font-display text-[36px] leading-none ${
          accent ? "text-ember" : "text-ink"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolEntry }) {
  const required = ((tool.input_schema?.required as string[]) || []).slice();
  const properties =
    (tool.input_schema?.properties as Record<string, Record<string, unknown>>) || {};
  const props = Object.entries(properties);

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4 p-5 hover:bg-wheat/40">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-display text-[22px] leading-tight text-ink">
              {tool.name}
            </span>
            <SourceChip source={tool.source} />
          </div>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink/75">
            {tool.description || (
              <em className="italic text-ink/45">No description provided.</em>
            )}
          </p>
          {props.length > 0 && (
            <p className="mt-2 font-mono text-[11px] tracking-[0.05em] text-ink/55">
              args:{" "}
              {props.map(([n], i) => (
                <span key={n}>
                  {i > 0 && <span className="text-ink/30"> · </span>}
                  <span
                    className={
                      required.includes(n)
                        ? "text-ember"
                        : "text-ink/65"
                    }
                  >
                    {n}
                    {required.includes(n) ? "" : "?"}
                  </span>
                </span>
              ))}
            </p>
          )}
        </div>
        <span className="mt-2 shrink-0 font-mono text-[10px] uppercase tracking-[0.22em] text-ink/55 group-open:text-ember">
          <span className="hidden group-open:inline">hide schema</span>
          <span className="inline group-open:hidden">view schema →</span>
        </span>
      </summary>

      <div className="border-t border-hairline px-5 py-4">
        <CodeBlock
          code={JSON.stringify(tool.input_schema, null, 2)}
          highlight={schemaHighlight}
        />
      </div>
    </details>
  );
}

function SourceChip({ source }: { source: "local" | "mcp" }) {
  if (source === "mcp") {
    return (
      <span className="inline-block border border-ember bg-ember/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ember">
        mcp · remote
      </span>
    );
  }
  return (
    <span className="inline-block border border-ink bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-ink">
      local
    </span>
  );
}

const schemaHighlight: HighlightRule[] = [
  { match: /"(name|description|input_schema|required|properties|type)"/g, className: "text-ember" },
  { match: /"(object|string|integer|number|boolean|array)"/g, className: "text-ink font-semibold" },
];

/* ============================================================
 * Shared: CodeBlock with token highlighting
 * ============================================================ */

type HighlightRule = { match: RegExp; className: string };

function CodeBlock({
  code,
  highlight = [],
}: {
  code: string;
  highlight?: HighlightRule[];
}) {
  // Tokenize: walk the string, emit highlighted spans where rules match,
  // plain spans elsewhere. Greedy; first matching rule wins per position.
  const segments: Array<{ text: string; className?: string }> = [];
  let i = 0;
  while (i < code.length) {
    let bestStart = -1;
    let bestEnd = -1;
    let bestClass: string | undefined;

    for (const rule of highlight) {
      rule.match.lastIndex = i;
      const m = rule.match.exec(code);
      if (!m) continue;
      if (bestStart === -1 || m.index < bestStart) {
        bestStart = m.index;
        bestEnd = m.index + m[0].length;
        bestClass = rule.className;
      }
    }

    if (bestStart === -1) {
      segments.push({ text: code.slice(i) });
      break;
    }
    if (bestStart > i) {
      segments.push({ text: code.slice(i, bestStart) });
    }
    segments.push({ text: code.slice(bestStart, bestEnd), className: bestClass });
    i = bestEnd;
  }

  return (
    <pre
      className="overflow-x-auto border border-ink bg-[#1B2410] p-5 font-mono text-[12.5px] leading-[1.7]"
      style={{ color: "#E9DDC2" }}
    >
      <code>
        {segments.map((s, idx) => (
          <span key={idx} className={s.className}>
            {s.text}
          </span>
        ))}
      </code>
    </pre>
  );
}
