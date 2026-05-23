"use client";

import { useEffect, useState } from "react";
import { extractText, getKBText, listKB, startRun } from "@/lib/api";
import type { KBDocument } from "@/lib/types";
import {
  CloseMark,
  PageMark,
  ReloadMark,
  UploadMark,
} from "@/components/Marks";

type Resume = { candidate_id: string; text: string };

const MANUAL = "__manual__";
const SAMPLE_JD = `Senior React Developer

Minimum qualifications: 3+ years React, strong TypeScript, REST APIs.
Nice to have: Next.js, GraphQL, perf optimization.`;

export function RunForm({ onStarted }: { onStarted: (runId: string) => void }) {
  const [jobId, setJobId] = useState("senior-react");
  const [jd, setJd] = useState("");
  const [jdSource, setJdSource] = useState<string>(MANUAL);
  const [kbDocs, setKbDocs] = useState<KBDocument[]>([]);
  const [kbLoading, setKbLoading] = useState(true);
  const [resumes, setResumes] = useState<Resume[]>([
    { candidate_id: "resume_001", text: "" },
  ]);
  const [topN, setTopN] = useState(3);
  const [temperature, setTemperature] = useState(0.7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickBestKBDoc(docs: KBDocument[], currentJobId: string) {
    if (docs.length === 0) return undefined;
    const slug = currentJobId.trim().toLowerCase();
    if (slug) {
      const match = docs.find((d) => d.filename.toLowerCase().includes(slug));
      if (match) return match;
    }
    return docs[0];
  }

  async function refreshKB(autoSelect = true) {
    setKbLoading(true);
    try {
      const docs = await listKB();
      setKbDocs(docs);
      if (autoSelect) {
        const best = pickBestKBDoc(docs, jobId);
        if (best) await loadFromKB(best.id);
      }
    } catch {
      // soft-fail
    } finally {
      setKbLoading(false);
    }
  }

  useEffect(() => {
    refreshKB(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadFromKB(docId: string) {
    try {
      const r = await getKBText(docId);
      setJd(r.text);
      setJdSource(docId);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function onJDSourceChange(value: string) {
    if (value === MANUAL) {
      setJdSource(MANUAL);
      return;
    }
    await loadFromKB(value);
  }

  function addResume() {
    setResumes((r) => [
      ...r,
      {
        candidate_id: `resume_${String(r.length + 1).padStart(3, "0")}`,
        text: "",
      },
    ]);
  }
  function updateResume(i: number, patch: Partial<Resume>) {
    setResumes((r) => r.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  }
  function removeResume(i: number) {
    setResumes((r) => r.filter((_, idx) => idx !== i));
  }

  async function onResumeFile(i: number, file: File) {
    const name = file.name.toLowerCase();
    const needsServer = name.endsWith(".pdf") || name.endsWith(".docx");
    let text: string;
    try {
      if (needsServer) {
        const r = await extractText(file);
        text = r.text;
        if (r.warnings.length > 0) setError(r.warnings.join(" "));
      } else {
        text = await file.text();
      }
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    updateResume(i, { text });
    if (jdSource !== MANUAL || !jd.trim()) {
      const best = pickBestKBDoc(kbDocs, jobId);
      if (best) await loadFromKB(best.id);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const usedJd = jd.trim() || SAMPLE_JD;
      const r = await startRun({
        job_id: jobId,
        job_description: usedJd,
        resumes: resumes.filter((r) => r.text.trim().length > 0),
        top_n: topN,
        temperature,
        max_iterations: 10,
        recipient: "hiring.manager@company.com",
      });
      onStarted(r.run_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const selectedKBDoc = kbDocs.find((d) => d.id === jdSource);

  return (
    <div className="space-y-10">
      {/* Section I — Setup */}
      <section className="space-y-5">
        <div className="flex items-baseline justify-between border-b border-hairline pb-2">
          <p className="eyebrow">I. Brief</p>
          <p className="font-mono text-[11px] tracking-[0.12em] text-ink/50">
            requisition
          </p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          <div className="sm:col-span-1">
            <label className="label" htmlFor="job_id">
              Job ID
            </label>
            <input
              id="job_id"
              className="input font-mono"
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="top_n">
              Top N
            </label>
            <input
              id="top_n"
              type="number"
              min={1}
              max={10}
              className="input font-mono"
              value={topN}
              onChange={(e) => setTopN(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label" htmlFor="temp">
              Temperature
            </label>
            <input
              id="temp"
              type="number"
              min={0}
              max={2}
              step={0.1}
              className="input font-mono"
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
            />
          </div>
        </div>
      </section>

      {/* Section II — Job description */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b border-hairline pb-2">
          <p className="eyebrow">II. Job description</p>
          <div className="flex items-center gap-2">
            <select
              id="jd_source"
              value={jdSource}
              onChange={(e) => onJDSourceChange(e.target.value)}
              className="input font-mono text-[12px]"
              aria-label="Job description source"
            >
              <option value={MANUAL}>— Write your own —</option>
              {kbDocs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.filename}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => refreshKB(false)}
              className="btn-ghost"
              aria-label="Refresh KB list"
            >
              <ReloadMark size={12} className={kbLoading ? "orbit" : ""} />
            </button>
          </div>
        </div>

        {selectedKBDoc && (
          <p className="flex items-center gap-2 text-[12px] italic text-ink/65">
            <PageMark size={12} className="text-ember" />
            Using JD from{" "}
            <span className="font-mono not-italic">
              {selectedKBDoc.filename}
            </span>{" "}
            — edits below stay local to this run.
          </p>
        )}
        {!selectedKBDoc && kbDocs.length === 0 && !kbLoading && (
          <p className="text-[12px] italic text-ink/65">
            Tip: upload JDs in{" "}
            <a href="/kb" className="text-ember underline-offset-2 hover:underline">
              the library
            </a>{" "}
            so they auto-populate here.
          </p>
        )}

        <textarea
          id="jd"
          rows={8}
          className="input"
          placeholder="Paste the job description, or pick one from the library above…"
          value={jd}
          onChange={(e) => {
            setJd(e.target.value);
            if (jdSource !== MANUAL) setJdSource(MANUAL);
          }}
        />
      </section>

      {/* Section III — Resumes */}
      <section className="space-y-4">
        <div className="flex items-baseline justify-between border-b border-hairline pb-2">
          <p className="eyebrow">
            III. Candidates · {resumes.length}{" "}
            {resumes.length === 1 ? "resume" : "resumes"}
          </p>
          <button onClick={addResume} className="btn-ghost">
            + Add candidate
          </button>
        </div>
        <div className="space-y-3">
          {resumes.map((r, i) => (
            <div key={i} className="border border-hairline bg-cream p-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-[11px] tracking-[0.18em] text-ink/55">
                  №{String(i + 1).padStart(2, "0")}
                </span>
                <input
                  className="input flex-1 font-mono"
                  value={r.candidate_id}
                  onChange={(e) =>
                    updateResume(i, { candidate_id: e.target.value })
                  }
                />
                <label className="btn-ghost cursor-pointer">
                  <UploadMark size={12} />
                  <span>Attach file</span>
                  <input
                    type="file"
                    accept=".txt,.md,.pdf,.docx"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onResumeFile(i, f);
                    }}
                  />
                </label>
                <button
                  onClick={() => removeResume(i)}
                  className="btn-ghost text-[color:var(--rust)]"
                >
                  <CloseMark size={12} />
                  <span>Remove</span>
                </button>
              </div>
              <textarea
                rows={5}
                className="input mt-3"
                placeholder="Paste resume text here, or attach .txt / .md / .pdf / .docx above"
                value={r.text}
                onChange={(e) => updateResume(i, { text: e.target.value })}
              />
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          {error}
        </div>
      )}

      <div className="flex flex-col items-stretch justify-between gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center">
        <p className="font-display text-[18px] italic text-ink/70">
          When the brief is set, ring the bell.
        </p>
        <button onClick={submit} disabled={busy} className="btn-primary">
          {busy ? "Starting…" : "Begin the run →"}
        </button>
      </div>
    </div>
  );
}
