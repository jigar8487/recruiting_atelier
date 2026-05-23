"use client";

import type { RunRecord } from "@/lib/runHistory";

type Props = {
  records: RunRecord[];
  onClear?: () => void;
  onPick?: (runId: string, candidateId: string) => void;
};

function fmtDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** Flatten a list of runs into one row per (run, candidate) pair, newest first. */
function flatten(records: RunRecord[]) {
  const rows: Array<{
    key: string;
    when: string;
    candidate_id: string;
    jd_filename: string;
    score: number;
    rank: number;
    run_id: string;
  }> = [];
  for (const r of records) {
    r.results.forEach((c, idx) => {
      rows.push({
        key: `${r.run_id}-${c.candidate_id}-${idx}`,
        when: r.created,
        candidate_id: c.candidate_id,
        jd_filename: r.jd_filename,
        score: c.score,
        rank: idx + 1,
        run_id: r.run_id,
      });
    });
  }
  return rows;
}

export function RunHistoryTable({ records, onClear, onPick }: Props) {
  const rows = flatten(records);

  if (rows.length === 0) {
    return (
      <div className="border border-hairline bg-cream p-8 text-center">
        <p className="font-display text-[22px] italic leading-tight text-ink/70">
          No scans on file yet.
        </p>
        <p className="mt-2 text-[13px] text-ink/60">
          Drop a CV above and the agent will start working.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-end justify-between border-b border-hairline pb-2">
        <p className="eyebrow">Past scans · {records.length}</p>
        {onClear && (
          <button onClick={onClear} className="btn-ghost">
            Clear all
          </button>
        )}
      </div>
      <div className="border border-hairline border-t-0">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-hairline bg-wheat/50">
              <th className="px-4 py-3 text-left">
                <span className="eyebrow">Scanned</span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="eyebrow">Candidate</span>
              </th>
              <th className="px-4 py-3 text-left">
                <span className="eyebrow">Matched JD</span>
              </th>
              <th className="px-4 py-3 text-right">
                <span className="eyebrow">Score</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const clickable = !!onPick;
              return (
                <tr
                  key={r.key}
                  onClick={() => onPick?.(r.run_id, r.candidate_id)}
                  className={`border-b border-hairline last:border-b-0 hover:bg-wheat/40 ${
                    clickable ? "cursor-pointer" : ""
                  }`}
                  tabIndex={clickable ? 0 : -1}
                  onKeyDown={(e) => {
                    if (clickable && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onPick?.(r.run_id, r.candidate_id);
                    }
                  }}
                >
                  <td className="px-4 py-3 font-mono text-[11px] text-ink/65">
                    {fmtDate(r.when)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-[11px] text-ink/55">
                      №{String(r.rank).padStart(2, "0")}{" "}
                    </span>
                    <span
                      className={`font-display text-[15px] text-ink ${
                        clickable ? "underline-offset-2 group-hover:underline" : ""
                      }`}
                    >
                      {r.candidate_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 italic text-ink/75">
                    {r.jd_filename}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-ember">
                    {r.score}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
