"use client";

import { useEffect } from "react";
import type { CandidateDetail, RunRecord } from "@/lib/runHistory";
import {
  AlertMark,
  CheckMark,
  CloseMark,
  PendingMark,
} from "@/components/Marks";

type Props = {
  open: boolean;
  onClose: () => void;
  record: RunRecord | null;
  detail: CandidateDetail | null;
};

const DIMENSIONS: Array<{ key: keyof NonNullable<CandidateDetail["score"]>["breakdown"]; label: string }> = [
  { key: "skills", label: "Skills" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "communication", label: "Communication" },
] as const;

export function CandidateDetailDrawer({ open, onClose, record, detail }: Props) {
  // ESC to close, body scroll lock
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      {/* backdrop */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{
          background: "rgba(52, 79, 31, 0.55)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />

      {/* drawer */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Candidate detail"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[760px] flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "#F9F5F0",
          boxShadow:
            "-24px 0 60px -16px rgba(52, 79, 31, 0.45), -1px 0 0 0 rgba(52, 79, 31, 0.25)",
        }}
      >
        {record && detail ? (
          <DrawerBody record={record} detail={detail} onClose={onClose} />
        ) : record ? (
          <DrawerMissingDetail record={record} onClose={onClose} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
              · no candidate selected ·
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

/* =========================================================================
 * Body — full detail (record + per-candidate trail)
 * ========================================================================= */

function DrawerBody({
  record,
  detail,
  onClose,
}: {
  record: RunRecord;
  detail: CandidateDetail;
  onClose: () => void;
}) {
  const overall = detail.score?.overall ?? 0;
  const isDuplicate = detail.vet?.is_duplicate === true;
  const wasScreened = detail.screen !== undefined;
  const passed = detail.screen?.passed ?? false;
  const wasScored = detail.score !== undefined;
  const inShortlist = detail.in_shortlist;

  return (
    <>
      {/* Header */}
      <header className="border-b border-hairline px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Candidate · {record.created.slice(0, 10)}</p>
            <h2 className="mt-1 truncate font-display text-[28px] leading-tight text-ink">
              {detail.candidate_id}
            </h2>
            <p className="mt-1 font-display text-[14px] italic text-ink/65">
              Matched against{" "}
              <span className="font-mono not-italic text-ink/75">
                {record.jd_filename}
              </span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="btn-ghost">
            <CloseMark size={14} />
            <span>Close</span>
          </button>
        </div>

        {/* Score badge + outcome chip */}
        <div className="mt-5 flex flex-wrap items-end gap-6">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">
              Overall score
            </p>
            <p className="mt-1 font-display text-[56px] leading-none text-ember">
              {wasScored ? overall : "—"}
              <span className="ml-1 font-display text-[18px] italic text-ink/50">
                /100
              </span>
            </p>
          </div>
          <OutcomeChip
            isDuplicate={isDuplicate}
            passed={passed}
            wasScreened={wasScreened}
            inShortlist={inShortlist}
            rank={detail.rank}
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-7">
        <div className="space-y-10">
          {/* Score breakdown — chart */}
          {detail.score?.breakdown && (
            <section>
              <div className="border-b border-hairline pb-2">
                <p className="eyebrow">Diya&apos;s scoring breakdown</p>
              </div>
              <div className="mt-5 space-y-4">
                {DIMENSIONS.map(({ key, label }) => (
                  <BarRow
                    key={key}
                    label={label}
                    value={detail.score!.breakdown![key]}
                  />
                ))}
              </div>
              {detail.score?.justification && (
                <p className="mt-5 border-l-2 border-ember bg-wheat/50 px-4 py-3 font-display text-[14.5px] italic leading-relaxed text-ink/80">
                  &ldquo;{detail.score.justification}&rdquo;
                </p>
              )}
            </section>
          )}

          {/* Agent trail */}
          <section>
            <div className="border-b border-hairline pb-2">
              <p className="eyebrow">Agent trail · what each specialist decided</p>
            </div>
            <ol className="mt-5 space-y-px bg-ink/15">
              <AgentRow
                num="00"
                person="Kavya"
                role="Vetter"
                status={
                  !detail.vet
                    ? "skipped"
                    : detail.vet.is_duplicate
                    ? "blocked"
                    : "passed"
                }
                line={
                  !detail.vet
                    ? "Not vetted in this run."
                    : detail.vet.is_duplicate
                    ? `DUPLICATE of ${detail.vet.matched_id} — ${detail.vet.reason ?? "matched"}`
                    : `Unique — ${detail.vet.reason ?? "first sighting"}`
                }
              />
              <AgentRow
                num="01"
                person="Anaya"
                role="Screener"
                status={
                  !wasScreened
                    ? "skipped"
                    : passed
                    ? "passed"
                    : "blocked"
                }
                line={
                  !wasScreened
                    ? isDuplicate
                      ? "Skipped — Kavya filtered this candidate."
                      : "Did not run."
                    : passed
                    ? `Passed${detail.screen?.reason ? ` — ${detail.screen.reason}` : ""}`
                    : `Failed${detail.screen?.reason ? ` — ${detail.screen.reason}` : ""}`
                }
              />
              <AgentRow
                num="02"
                person="Diya"
                role="Scorer"
                status={!wasScored ? "skipped" : "passed"}
                line={
                  !wasScored
                    ? !passed && wasScreened
                      ? "Skipped — Anaya screened this candidate out."
                      : "Did not score."
                    : `Overall ${overall}/100${
                        detail.score?.breakdown
                          ? ` · weighted from ${shortBreakdown(detail.score.breakdown)}`
                          : ""
                      }`
                }
              />
              <AgentRow
                num="03"
                person="Tara"
                role="Shortlister"
                status={inShortlist ? "passed" : wasScored ? "blocked" : "skipped"}
                line={
                  inShortlist
                    ? `Shortlisted at rank #${detail.rank}`
                    : wasScored
                    ? "Did not make the top N."
                    : "Skipped — never reached scoring."
                }
              />
              <AgentRow
                num="04"
                person="Riya"
                role="Notifier"
                status={inShortlist ? "passed" : "skipped"}
                line={
                  inShortlist
                    ? "Included in the dispatch email."
                    : "Not in the dispatch — only shortlisted candidates are notified."
                }
              />
            </ol>
          </section>

          {/* Run context table */}
          <section>
            <div className="border-b border-hairline pb-2">
              <p className="eyebrow">Run context</p>
            </div>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-mono text-[12px]">
              <dt className="text-ink/55">Run id</dt>
              <dd>{record.run_id}</dd>
              <dt className="text-ink/55">Created</dt>
              <dd>{new Date(record.created).toLocaleString()}</dd>
              <dt className="text-ink/55">Job id</dt>
              <dd>{record.job_id}</dd>
              <dt className="text-ink/55">JD</dt>
              <dd>{record.jd_filename}</dd>
              <dt className="text-ink/55">CVs submitted</dt>
              <dd>{record.cv_filenames.length}</dd>
              {record.tokens_in !== undefined && (
                <>
                  <dt className="text-ink/55">Tokens in / out</dt>
                  <dd>
                    {record.tokens_in.toLocaleString()} /{" "}
                    {record.tokens_out?.toLocaleString() ?? 0}
                  </dd>
                </>
              )}
              {record.cost_usd !== undefined && (
                <>
                  <dt className="text-ink/55">Cost</dt>
                  <dd className="text-ember">
                    ${record.cost_usd.toFixed(4)}
                  </dd>
                </>
              )}
              {record.latency_ms !== undefined && (
                <>
                  <dt className="text-ink/55">Latency</dt>
                  <dd>{record.latency_ms}ms</dd>
                </>
              )}
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}

/* =========================================================================
 * Body — legacy record without candidate detail
 * ========================================================================= */

function DrawerMissingDetail({
  record,
  onClose,
}: {
  record: RunRecord;
  onClose: () => void;
}) {
  return (
    <>
      <header className="border-b border-hairline px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Candidate</p>
            <h2 className="mt-1 font-display text-[28px] leading-tight text-ink">
              No detail available
            </h2>
          </div>
          <button onClick={onClose} className="btn-ghost">
            <CloseMark size={14} />
            <span>Close</span>
          </button>
        </div>
      </header>
      <div className="flex flex-1 items-center justify-center px-10 text-center">
        <div>
          <p className="font-display text-[20px] italic text-ink/65">
            This scan was recorded before per-candidate detail was tracked.
          </p>
          <p className="mt-3 text-[13.5px] text-ink/65">
            Re-run the candidate to see Kavya&apos;s vet result, Anaya&apos;s
            screen reason, Diya&apos;s 4-dimension breakdown, and Tara&apos;s
            ranking decision.
          </p>
          <p className="mt-4 font-mono text-[11px] tracking-[0.05em] text-ink/45">
            Run {record.run_id.slice(0, 8)} · {new Date(record.created).toLocaleString()}
          </p>
        </div>
      </div>
    </>
  );
}

/* =========================================================================
 * Building blocks
 * ========================================================================= */

function BarRow({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[120px_1fr_50px]">
      <p className="font-display text-[15px] text-ink">{label}</p>
      <div className="relative h-3 bg-ink/10">
        <div
          className="absolute inset-y-0 left-0 bg-ember transition-[width] duration-500"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>
      <p className="text-right font-mono text-[13px] text-ink">{value}</p>
    </div>
  );
}

type AgentStatus = "passed" | "blocked" | "skipped";

function AgentRow({
  num,
  person,
  role,
  status,
  line,
}: {
  num: string;
  person: string;
  role: string;
  status: AgentStatus;
  line: string;
}) {
  return (
    <li className="bg-cream p-4">
      <div className="flex items-start gap-4">
        <span className="mt-0.5">
          <AgentStatusIcon status={status} />
        </span>
        <div className="flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] text-ink/45">
            {num} · {person.toUpperCase()}
          </p>
          <p className="mt-0.5 font-display text-[18px] leading-tight text-ink">
            {person}{" "}
            <span className="italic text-ink/55">— the {role}</span>
          </p>
          <p className="mt-1 text-[13px] leading-snug text-ink/75">
            {line}
          </p>
        </div>
        <AgentStatusPill status={status} />
      </div>
    </li>
  );
}

function AgentStatusIcon({ status }: { status: AgentStatus }) {
  if (status === "passed") return <CheckMark size={18} className="text-ink" />;
  if (status === "blocked") return <AlertMark size={18} className="text-[color:var(--rust)]" />;
  return <PendingMark size={18} className="text-ink/40" />;
}

function AgentStatusPill({ status }: { status: AgentStatus }) {
  if (status === "passed") return <span className="pill pill-ink">Passed</span>;
  if (status === "blocked")
    return <span className="pill pill-rust">Blocked</span>;
  return <span className="pill border-ink/30 text-ink/50">Skipped</span>;
}

function OutcomeChip({
  isDuplicate,
  passed,
  wasScreened,
  inShortlist,
  rank,
}: {
  isDuplicate: boolean;
  passed: boolean;
  wasScreened: boolean;
  inShortlist: boolean;
  rank: number | null;
}) {
  if (isDuplicate) {
    return (
      <span className="pill pill-rust text-[11px]">
        Duplicate — skipped by Kavya
      </span>
    );
  }
  if (inShortlist) {
    return (
      <span className="pill pill-ember text-[11px]">
        Shortlisted · rank #{rank}
      </span>
    );
  }
  if (wasScreened && !passed) {
    return (
      <span className="pill pill-rust text-[11px]">
        Failed screen
      </span>
    );
  }
  return (
    <span className="pill border-ink/40 text-ink/60 text-[11px]">
      Did not make the cut
    </span>
  );
}

function shortBreakdown(b: NonNullable<CandidateDetail["score"]>["breakdown"]): string {
  if (!b) return "";
  return `skl ${b.skills} · exp ${b.experience} · edu ${b.education} · com ${b.communication}`;
}
