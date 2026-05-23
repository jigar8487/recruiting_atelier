"use client";

import type { RunEvent } from "@/lib/types";
import {
  AlertMark,
  CheckMark,
  OrbitMark,
  PendingMark,
} from "@/components/Marks";

type StageKey = "vet" | "screen" | "score" | "shortlist" | "notify";
const STAGES: { key: StageKey; person: string; role: string; verb: string }[] = [
  { key: "vet", person: "Kavya", role: "Vetter", verb: "catches duplicates" },
  { key: "screen", person: "Anaya", role: "Screener", verb: "filters the field" },
  { key: "score", person: "Diya", role: "Scorer", verb: "weighs the candidates" },
  { key: "shortlist", person: "Tara", role: "Shortlister", verb: "selects the finalists" },
  { key: "notify", person: "Riya", role: "Notifier", verb: "drafts the dispatch" },
];

type StageState = {
  status: "pending" | "active" | "complete" | "error";
  chunks: RunEvent[];
  completePayload?: Record<string, unknown>;
  errorPayload?: Record<string, unknown>;
};

function reduce(events: RunEvent[]): Record<StageKey, StageState> {
  const out: Record<StageKey, StageState> = {
    vet: { status: "pending", chunks: [] },
    screen: { status: "pending", chunks: [] },
    score: { status: "pending", chunks: [] },
    shortlist: { status: "pending", chunks: [] },
    notify: { status: "pending", chunks: [] },
  };
  for (const e of events) {
    if (!(e.stage in out)) continue;
    const s = out[e.stage as StageKey];
    if (e.event === "start") s.status = "active";
    if (e.event === "chunk") s.chunks.push(e);
    if (e.event === "complete") {
      s.status = "complete";
      s.completePayload = e.payload;
    }
    if (e.event === "error") {
      s.status = "error";
      s.errorPayload = e.payload;
    }
  }
  return out;
}

export function Timeline({ events }: { events: RunEvent[] }) {
  const by = reduce(events);
  return (
    <ol className="space-y-px bg-ink/15">
      {STAGES.map(({ key, person, role, verb }, i) => {
        const s = by[key];
        return (
          <li key={key} className="bg-cream p-5">
            <div className="flex items-start gap-4">
              <span className="mt-0.5">
                <StatusIcon status={s.status} />
              </span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-display text-[20px] leading-tight text-ink">
                    <span className="font-mono text-[11px] tracking-[0.22em] text-ink/50">
                      0{i + 1}.
                    </span>{" "}
                    <span className="text-ember">{person}</span>
                    <span className="ml-1 italic text-ink/55">, the {role}</span>
                    <span className="ml-2 italic text-ink/55"> — {verb}</span>
                  </p>
                  <StatusPill status={s.status} />
                </div>

                {s.chunks.length > 0 && (
                  <ul className="mt-3 space-y-1.5 text-[13px] text-ink/75">
                    {s.chunks.map((c, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-mono text-[10px] text-ink/40">
                          ·
                        </span>
                        <ChunkLine event={c} />
                      </li>
                    ))}
                  </ul>
                )}

                {key === "shortlist" &&
                  s.completePayload &&
                  Array.isArray(s.completePayload.candidates) && (
                    <ol className="mt-4 divide-y divide-hairline border-t border-hairline">
                      {(
                        s.completePayload.candidates as Array<{
                          candidate_id: string;
                          score: number;
                        }>
                      ).map((c, idx) => (
                        <li
                          key={c.candidate_id}
                          className="flex items-baseline justify-between py-2"
                        >
                          <span className="flex items-baseline gap-3">
                            <span className="font-mono text-[11px] text-ink/50">
                              №{String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="font-display text-[16px] text-ink">
                              {c.candidate_id}
                            </span>
                          </span>
                          <span className="font-mono text-[13px] text-ember">
                            {c.score}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}

                {key === "notify" && s.completePayload?.email && (
                  <div className="mt-4 border-l-2 border-ember bg-wheat/60 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
                      Dispatch
                    </p>
                    <p className="mt-2 font-display text-[17px] italic text-ink">
                      {
                        (s.completePayload.email as Record<string, string>)
                          .subject
                      }
                    </p>
                    <pre className="mt-3 whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink/80">
                      {(s.completePayload.email as Record<string, string>).body}
                    </pre>
                  </div>
                )}

                {s.errorPayload && (
                  <p className="mt-3 text-[13px] text-[color:var(--rust)]">
                    {String(s.errorPayload.message || "error")}
                  </p>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function StatusPill({ status }: { status: StageState["status"] }) {
  if (status === "complete")
    return <span className="pill pill-ink">Set</span>;
  if (status === "active")
    return <span className="pill pill-ember">In hand</span>;
  if (status === "error")
    return <span className="pill pill-rust">Misfire</span>;
  return (
    <span className="pill border-ink/30 text-ink/50">Awaiting</span>
  );
}

function StatusIcon({ status }: { status: StageState["status"] }) {
  if (status === "complete")
    return <CheckMark size={20} className="text-ink" />;
  if (status === "active")
    return <OrbitMark size={20} className="text-ember" />;
  if (status === "error")
    return <AlertMark size={20} className="text-[color:var(--rust)]" />;
  return <PendingMark size={20} className="text-ink/40" />;
}

function ChunkLine({ event }: { event: RunEvent }) {
  const p = event.payload;
  if (event.stage === "vet") {
    const isDup = Boolean(p.is_duplicate);
    return (
      <span>
        <span className="font-mono">{String(p.candidate_id)}</span>
        {" → "}
        <span className={isDup ? "text-[color:var(--rust)]" : "text-ink"}>
          {isDup ? "DUPLICATE" : "unique"}
        </span>
        {isDup && p.matched_id ? (
          <span className="italic text-ink/55">
            {" "}
            (of <span className="font-mono not-italic">{String(p.matched_id)}</span>
            {p.reason ? ` — ${String(p.reason)}` : ""})
          </span>
        ) : null}
      </span>
    );
  }
  if (event.stage === "screen") {
    return (
      <span>
        <span className="font-mono">{String(p.candidate_id)}</span>
        {" → "}
        <span
          className={
            p.passed ? "text-ink" : "text-[color:var(--rust)]"
          }
        >
          {p.passed ? "passed" : "failed"}
        </span>
        {p.reason ? (
          <span className="italic text-ink/55"> ({String(p.reason)})</span>
        ) : null}
      </span>
    );
  }
  if (event.stage === "score") {
    const breakdown = p.breakdown as
      | {
          skills?: number;
          experience?: number;
          education?: number;
          communication?: number;
        }
      | undefined;
    return (
      <span className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <span className="font-mono">{String(p.candidate_id)}</span>
        <span className="text-ink/40">—</span>
        <span className="font-mono text-ember">
          overall {String(p.score)}
        </span>
        {breakdown && (
          <span className="font-mono text-[11px] text-ink/55">
            (
            <DimChip label="skl" value={breakdown.skills} />
            <DimChip label="exp" value={breakdown.experience} />
            <DimChip label="edu" value={breakdown.education} />
            <DimChip label="com" value={breakdown.communication} />)
          </span>
        )}
      </span>
    );
  }
  return <span className="font-mono text-[11px]">{JSON.stringify(p)}</span>;
}

function DimChip({ label, value }: { label: string; value: number | undefined }) {
  if (value === undefined) return null;
  return (
    <span className="ml-2 first:ml-0">
      {label} <span className="text-ink/75">{value}</span>
    </span>
  );
}
