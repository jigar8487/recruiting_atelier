"use client";

import { useEffect, useState } from "react";
import { getShortlists } from "@/lib/api";
import type { Shortlist } from "@/lib/types";

export function ShortlistTable({ jobId }: { jobId: string }) {
  const [data, setData] = useState<Shortlist[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getShortlists(jobId).then(setData).catch((e) => setError(e.message));
  }, [jobId]);

  if (error) {
    return (
      <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
        {error}
      </div>
    );
  }
  if (!data)
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
        · loading ·
      </p>
    );
  if (data.length === 0) {
    return (
      <p className="font-display text-[20px] italic text-ink/60">
        No shortlists for this job yet — the register is empty.
      </p>
    );
  }

  return (
    <div className="border border-hairline">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-hairline bg-wheat/50">
            <th className="px-4 py-3 text-left">
              <span className="eyebrow">Filed</span>
            </th>
            <th className="px-4 py-3 text-left">
              <span className="eyebrow">Candidates</span>
            </th>
            <th className="px-4 py-3 text-right">
              <span className="eyebrow">Top</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((s, i) => (
            <tr
              key={i}
              className="border-b border-hairline last:border-b-0 hover:bg-wheat/40"
            >
              <td className="px-4 py-3 font-mono text-[11px] text-ink/65">
                {s.created}
              </td>
              <td className="px-4 py-3 text-ink">
                {s.candidates.map((c) => c.candidate_id).join(" · ")}
              </td>
              <td className="px-4 py-3 text-right font-mono text-ember">
                {s.candidates.length > 0 ? s.candidates[0].score : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
