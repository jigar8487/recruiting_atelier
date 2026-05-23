"use client";

import { useRef, useState } from "react";
import { extractText, getKBText, startRun } from "@/lib/api";
import type { KBDocument } from "@/lib/types";
import { UploadMark, CloseMark } from "@/components/Marks";

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx";

type Resume = { candidate_id: string; filename: string; text: string };

type Props = {
  /** All JDs available in the KB. Must be non-empty (the parent guards this). */
  kbDocs: KBDocument[];
  /** Called when the run has been started successfully. */
  onStarted: (args: {
    run_id: string;
    job_id: string;
    jd_doc_id: string;
    jd_filename: string;
    cv_filenames: string[];
  }) => void;
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64) || "untitled";
}

export function CVUploader({ kbDocs, onStarted }: Props) {
  const [jdId, setJdId] = useState<string>(kbDocs[0]?.id ?? "");
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const selectedJd = kbDocs.find((d) => d.id === jdId) ?? kbDocs[0];

  async function readOne(file: File): Promise<Resume> {
    const name = file.name.toLowerCase();
    const needsServer = name.endsWith(".pdf") || name.endsWith(".docx");
    const text = needsServer
      ? (await extractText(file)).text
      : await file.text();
    return {
      candidate_id: slugify(file.name),
      filename: file.name,
      text,
    };
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || (files as FileList).length === 0) return;
    if (!selectedJd) return;
    setError(null);
    setBusy(true);

    try {
      const arr = Array.from(files);
      setExtracting(arr.length);
      const parsed: Resume[] = [];
      for (const f of arr) {
        try {
          parsed.push(await readOne(f));
        } catch (e) {
          setError(
            `Failed to read ${f.name}: ${(e as Error).message}`,
          );
          setBusy(false);
          setExtracting(0);
          return;
        }
      }
      setResumes(parsed);

      // Pull the JD's plain text so the agent has the brief.
      const jd = await getKBText(selectedJd.id);
      const jobId = slugify(selectedJd.filename);

      const r = await startRun({
        job_id: jobId,
        job_description: jd.text,
        resumes: parsed.map((p) => ({
          candidate_id: p.candidate_id,
          text: p.text,
        })),
        top_n: Math.min(parsed.length, 5),
        temperature: 0.7,
        max_iterations: 10,
        recipient: "hiring.manager@company.com",
      });

      onStarted({
        run_id: r.run_id,
        job_id: jobId,
        jd_doc_id: selectedJd.id,
        jd_filename: selectedJd.filename,
        cv_filenames: parsed.map((p) => p.filename),
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setExtracting(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section className="space-y-4">
      {/* JD picker (only when multiple JDs available) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="eyebrow">Match candidates against</p>
        {kbDocs.length > 1 ? (
          <select
            value={jdId}
            onChange={(e) => setJdId(e.target.value)}
            className="input font-mono text-[12px] sm:w-72"
            aria-label="Job description to match against"
          >
            {kbDocs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.filename}
              </option>
            ))}
          </select>
        ) : (
          <p className="font-mono text-[12px] text-ink/70">
            {selectedJd?.filename}
          </p>
        )}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!busy) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => !busy && inputRef.current?.click()}
        className={`letter group transition-colors ${
          busy ? "cursor-progress opacity-70" : "cursor-pointer"
        } ${dragOver ? "bg-wheat" : "hover:bg-wheat/50"}`}
      >
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <UploadMark size={28} className="text-ember" />
          <div>
            <p className="font-display text-[22px] italic leading-tight text-ink">
              Drop CVs to begin the scan
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
              Upload <strong className="text-ink">one or many</strong>. The agent
              starts automatically and ranks them against the brief above.
              <br />
              <span className="font-mono text-[11px] tracking-[0.05em]">
                .txt · .md · .pdf · .docx — 10 MB each
              </span>
            </p>
          </div>
          {busy && (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
              {extracting > 0
                ? `Reading ${extracting} file${extracting === 1 ? "" : "s"}…`
                : "Dispatching the agent…"}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          disabled={busy}
        />
      </div>

      {/* Just-read filenames preview */}
      {resumes.length > 0 && !busy && (
        <ul className="flex flex-wrap gap-2 text-[11px]">
          {resumes.map((r) => (
            <li
              key={r.candidate_id}
              className="border border-hairline bg-cream px-2 py-1 font-mono tracking-[0.05em] text-ink/70"
            >
              {r.filename}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="flex items-start justify-between gap-3 border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="btn-ghost text-[color:var(--rust)]"
            aria-label="Dismiss error"
          >
            <CloseMark size={12} />
          </button>
        </div>
      )}
    </section>
  );
}
