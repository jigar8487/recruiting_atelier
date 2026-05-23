"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listKB } from "@/lib/api";
import type { KBDocument } from "@/lib/types";
import {
  clearHistory,
  findCandidate,
  loadHistory,
  saveRun,
  type CandidateDetail,
  type RunRecord,
} from "@/lib/runHistory";
import { CVUploader } from "@/components/CVUploader";
import { RunStream, type CompletedRun } from "@/components/RunStream";
import { RunHistoryTable } from "@/components/RunHistoryTable";
import { CandidateDetailDrawer } from "@/components/CandidateDetailDrawer";
import { OutwardMark, PageMark } from "@/components/Marks";

type Pending = {
  run_id: string;
  job_id: string;
  jd_doc_id: string;
  jd_filename: string;
  cv_filenames: string[];
};

export default function RunPage() {
  // null = still fetching KB; [] = empty KB; KBDocument[] = ready
  const [kbDocs, setKbDocs] = useState<KBDocument[] | null>(null);
  const [history, setHistory] = useState<RunRecord[]>([]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [picked, setPicked] = useState<{
    record: RunRecord;
    detail: CandidateDetail | null;
  } | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    listKB()
      .then(setKbDocs)
      .catch(() => setKbDocs([]));
  }, []);

  function onRunStarted(meta: Pending) {
    setPending(meta);
  }

  function onRunComplete(result: CompletedRun) {
    if (!pending) return;
    const summary = result.summary ?? {};
    const record: RunRecord = {
      run_id: pending.run_id,
      created: new Date().toISOString(),
      job_id: pending.job_id,
      jd_filename: pending.jd_filename,
      jd_doc_id: pending.jd_doc_id,
      cv_filenames: pending.cv_filenames,
      results: result.candidates,
      candidates: result.candidateDetails,
      tokens_in: Number(summary.tokens_in ?? 0) || undefined,
      tokens_out: Number(summary.tokens_out ?? 0) || undefined,
      cost_usd: Number(summary.cost_usd ?? 0) || undefined,
      latency_ms: Number(summary.latency_ms ?? 0) || undefined,
    };
    saveRun(record);
    setHistory(loadHistory());
  }

  function pickCandidate(runId: string, candidateId: string) {
    const found = findCandidate(history, runId, candidateId);
    if (found) setPicked({ record: found.record, detail: found.detail });
  }

  function clearAllHistory() {
    if (typeof window !== "undefined" && !window.confirm("Clear all past scans on this browser?")) {
      return;
    }
    clearHistory();
    setHistory([]);
  }

  /* --------------------- render branches ----------------------------- */

  // Initial KB fetch in progress.
  if (kbDocs === null) {
    return (
      <ChapterShell>
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
          · loading ·
        </p>
      </ChapterShell>
    );
  }

  // KB is empty — must be filled before scanning.
  if (kbDocs.length === 0) {
    return (
      <ChapterShell>
        <div className="letter mt-2">
          <p className="eyebrow">Prerequisite</p>
          <h2 className="mt-2 font-display text-[28px] italic leading-tight text-ink">
            The library is empty.
          </h2>
          <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-ink/75">
            The agent needs at least one job description to match against
            before it can read a single CV. Add one to the knowledge base,
            then come back here.
          </p>
          <Link href="/kb" className="btn-primary mt-5">
            <PageMark size={12} />
            <span>Open the library</span>
            <OutwardMark size={11} />
          </Link>
        </div>
      </ChapterShell>
    );
  }

  // KB is ready — show upload + (live run or history).
  return (
    <ChapterShell>
      {/* Always-visible uploader (disabled while a run is in flight). */}
      <CVUploader kbDocs={kbDocs} onStarted={onRunStarted} />

      {/* Live run, if any. */}
      {pending && (
        <section className="mt-10 border-t border-hairline pt-8">
          <RunStream runId={pending.run_id} onComplete={onRunComplete} />
        </section>
      )}

      {/* Past scans — header always shown so the user understands where
          results will land. */}
      <section className="mt-10 space-y-3">
        {history.length === 0 && !pending ? (
          <div className="border border-dashed border-hairline bg-cream p-8 text-center">
            <p className="font-display text-[22px] italic leading-tight text-ink/70">
              No scans on file yet.
            </p>
            <p className="mt-2 text-[13px] text-ink/60">
              Drop your first CV above — the agent starts the moment a file
              lands.
            </p>
          </div>
        ) : (
          <>
            <RunHistoryTable
              records={history}
              onClear={history.length > 0 ? clearAllHistory : undefined}
              onPick={pickCandidate}
            />
            <p className="mt-2 text-[12px] italic text-ink/55">
              Click any row to open the candidate&apos;s detail — scoring
              breakdown, per-agent audit trail, pass/fail reasons.
            </p>
          </>
        )}
      </section>

      <CandidateDetailDrawer
        open={picked !== null}
        onClose={() => setPicked(null)}
        record={picked?.record ?? null}
        detail={picked?.detail ?? null}
      />
    </ChapterShell>
  );
}

function ChapterShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Chapter IV</p>
        <h1 className="headline mt-2 text-[44px] sm:text-[56px]">
          The <span className="italic">scan</span>.
        </h1>
        <p className="deck mt-4 max-w-2xl">
          Upload one CV or a stack of them.{" "}
          <span className="font-display not-italic text-ember">Kavya</span>{" "}
          catches duplicates first;{" "}
          <span className="font-display not-italic text-ember">Meera</span>{" "}
          plans what remains and routes it through her four specialists —{" "}
          <span className="font-display not-italic text-ember">Anaya</span>{" "}
          screens, <span className="font-display not-italic text-ember">Diya</span>{" "}
          scores, <span className="font-display not-italic text-ember">Tara</span>{" "}
          shortlists, <span className="font-display not-italic text-ember">Riya</span>{" "}
          notifies. Past scans on this browser are listed below for reference.
        </p>
      </header>
      {children}
    </div>
  );
}
