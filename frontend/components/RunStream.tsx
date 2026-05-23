"use client";

import { useEffect, useRef, useState } from "react";
import { openRunStream } from "@/lib/sse";
import type { RunEvent } from "@/lib/types";
import type { CandidateDetail, ScoreBreakdown } from "@/lib/runHistory";
import { Timeline } from "./Timeline";

export type CompletedRun = {
  candidates: Array<{ candidate_id: string; score: number; breakdown?: ScoreBreakdown }>;
  candidateDetails: CandidateDetail[];
  summary: Record<string, unknown> | null;
};

type Props = {
  runId: string;
  /** Fires exactly once when the run-level "complete" event arrives. */
  onComplete?: (result: CompletedRun) => void;
};

export function RunStream({ runId, onComplete }: Props) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const finalCandidatesRef = useRef<
    Array<{ candidate_id: string; score: number; breakdown?: ScoreBreakdown }>
  >([]);
  const detailMapRef = useRef<Map<string, CandidateDetail>>(new Map());
  const firedRef = useRef(false);

  function ensureDetail(id: string): CandidateDetail {
    const existing = detailMapRef.current.get(id);
    if (existing) return existing;
    const fresh: CandidateDetail = {
      candidate_id: id,
      rank: null,
      in_shortlist: false,
    };
    detailMapRef.current.set(id, fresh);
    return fresh;
  }

  useEffect(() => {
    finalCandidatesRef.current = [];
    detailMapRef.current = new Map();
    firedRef.current = false;
    setEvents([]);
    setDone(false);
    setSummary(null);
    setError(null);

    const close = openRunStream(
      runId,
      (ev) => {
        setEvents((xs) => [...xs, ev]);
        const p = ev.payload as Record<string, unknown>;

        // Kavya — vet
        if (ev.stage === "vet" && ev.event === "chunk" && p.candidate_id) {
          const d = ensureDetail(String(p.candidate_id));
          d.vet = {
            is_duplicate: Boolean(p.is_duplicate),
            matched_id: p.matched_id ? String(p.matched_id) : undefined,
            matched_when: p.matched_when ? String(p.matched_when) : undefined,
            reason: p.reason ? String(p.reason) : undefined,
          };
        }

        // Anaya — screen
        if (ev.stage === "screen" && ev.event === "chunk" && p.candidate_id) {
          const d = ensureDetail(String(p.candidate_id));
          d.screen = {
            passed: Boolean(p.passed),
            reason: p.reason ? String(p.reason) : undefined,
          };
        }

        // Diya — score
        if (ev.stage === "score" && ev.event === "chunk" && p.candidate_id) {
          const d = ensureDetail(String(p.candidate_id));
          const breakdown = (p.breakdown as ScoreBreakdown | undefined) ?? undefined;
          d.score = {
            overall: Number(p.score ?? 0),
            breakdown,
            justification: p.justification ? String(p.justification) : undefined,
          };
        }

        // Tara — shortlist
        if (
          ev.stage === "shortlist" &&
          ev.event === "complete" &&
          Array.isArray(p.candidates)
        ) {
          const finals = p.candidates as Array<{
            candidate_id: string;
            score: number;
            breakdown?: ScoreBreakdown;
          }>;
          finalCandidatesRef.current = finals;
          finals.forEach((c, idx) => {
            const d = ensureDetail(c.candidate_id);
            d.rank = idx + 1;
            d.in_shortlist = true;
            // Persist breakdown if score chunk hadn't emitted it
            if (c.breakdown && !d.score?.breakdown) {
              d.score = {
                overall: c.score,
                breakdown: c.breakdown,
                justification: d.score?.justification,
              };
            }
          });
        }

        if (ev.stage === "run" && ev.event === "complete") {
          const s = (p.summary as Record<string, unknown>) ?? null;
          setSummary(s);
          if (!firedRef.current && onComplete) {
            firedRef.current = true;
            onComplete({
              candidates: finalCandidatesRef.current,
              candidateDetails: Array.from(detailMapRef.current.values()),
              summary: s,
            });
          }
        }
      },
      () => setDone(true),
      (e) => setError(e.message),
    );
    return close;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runId]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-hairline pb-3">
        <div>
          <p className="eyebrow">Dispatch</p>
          <p className="mt-1 font-display text-[20px] italic text-ink">
            Run{" "}
            <span className="font-mono not-italic text-ember">
              {runId.slice(0, 8)}
            </span>
            {done ? (
              " — complete."
            ) : (
              <>
                {" — "}
                <span className="cursor not-italic">in progress</span>
              </>
            )}
          </p>
        </div>
        {summary && (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-right font-mono text-[11px] text-ink/70 sm:grid-cols-4">
            <div>
              <dt className="text-[9px] uppercase tracking-[0.22em] text-ink/50">
                tokens in/out
              </dt>
              <dd>
                {Number(summary.tokens_in ?? 0).toLocaleString()}
                {" / "}
                {Number(summary.tokens_out ?? 0).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] uppercase tracking-[0.22em] text-ink/50">
                cost
              </dt>
              <dd className="text-ember">
                ${Number(summary.cost_usd ?? 0).toFixed(4)}
              </dd>
            </div>
            <div>
              <dt className="text-[9px] uppercase tracking-[0.22em] text-ink/50">
                latency
              </dt>
              <dd>{Number(summary.latency_ms ?? 0)}ms</dd>
            </div>
            <div>
              <dt className="text-[9px] uppercase tracking-[0.22em] text-ink/50">
                spans
              </dt>
              <dd>{Number(summary.spans ?? 0)}</dd>
            </div>
          </dl>
        )}
      </header>

      {error && (
        <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          {error}
        </div>
      )}

      <Timeline events={events} />
    </div>
  );
}
