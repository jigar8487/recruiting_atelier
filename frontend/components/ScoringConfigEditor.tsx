"use client";

import { useEffect, useState } from "react";
import { getScoringConfig, setScoringConfig } from "@/lib/api";
import type { ScoringConfig } from "@/lib/types";
import { QuillMark, ReloadMark } from "@/components/Marks";

const DIMENSIONS = [
  {
    key: "weight_skills" as const,
    label: "Skills",
    body: "Coverage of the technical / role-specific skills the JD asks for.",
  },
  {
    key: "weight_experience" as const,
    label: "Experience",
    body: "Years and seniority relative to what the JD requires.",
  },
  {
    key: "weight_education" as const,
    label: "Education",
    body: "Degree level + field relevance. Skipped if the JD doesn't require one.",
  },
  {
    key: "weight_communication" as const,
    label: "Communication",
    body: "Written quality of the resume: clarity, structure, evidence of impact.",
  },
];

const DEFAULTS: ScoringConfig = {
  weight_skills: 0.40,
  weight_experience: 0.30,
  weight_education: 0.15,
  weight_communication: 0.15,
};

export function ScoringConfigEditor() {
  const [cfg, setCfg] = useState<ScoringConfig | null>(null);
  const [draft, setDraft] = useState<ScoringConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    getScoringConfig()
      .then((c) => {
        setCfg(c);
        setDraft(c);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  function update(key: keyof ScoringConfig, value: number) {
    if (!draft) return;
    setDraft({ ...draft, [key]: value });
    setSaved(null);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await setScoringConfig(draft);
      setCfg(saved);
      setDraft(saved);
      setSaved(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDraft(DEFAULTS);
    setSaved(null);
  }

  if (!draft || !cfg) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
        · loading scoring config ·
      </p>
    );
  }

  const sum =
    draft.weight_skills +
    draft.weight_experience +
    draft.weight_education +
    draft.weight_communication;
  const sumPct = Math.round(sum * 100);
  const sumOff = Math.abs(sumPct - 100);
  const dirty =
    cfg.weight_skills !== draft.weight_skills ||
    cfg.weight_experience !== draft.weight_experience ||
    cfg.weight_education !== draft.weight_education ||
    cfg.weight_communication !== draft.weight_communication;

  return (
    <div className="space-y-6">
      {error && (
        <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          {error}
        </div>
      )}

      <div className="border-b border-hairline pb-2">
        <div className="flex items-end justify-between">
          <p className="eyebrow">Scoring weights · 4 dimensions</p>
          <p
            className={`font-mono text-[11px] tracking-[0.12em] ${
              sumOff < 1 ? "text-ink/60" : "text-ember"
            }`}
          >
            sum = {sumPct}%{sumOff < 1 ? "" : ` · off by ${sumOff}`}
          </p>
        </div>
      </div>

      <p className="text-[13.5px] leading-relaxed text-ink/75">
        Each candidate is scored 0–100 on each dimension by{" "}
        <span className="font-display italic text-ember">Diya</span>, the
        Scorer. The overall match is a weighted average computed in Python
        from these four weights — so the math is auditable. Weights don&apos;t
        have to sum to 100% (we normalise), but it&apos;s easier to reason
        about if they do.
      </p>

      <div className="space-y-5">
        {DIMENSIONS.map((d) => (
          <DimensionRow
            key={d.key}
            label={d.label}
            body={d.body}
            value={draft[d.key]}
            onChange={(v) => update(d.key, v)}
            disabled={busy}
          />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
        <p className="font-display text-[14px] italic text-ink/65">
          {saved
            ? `Saved at ${saved}. Applies on the next run.`
            : dirty
            ? "Unsaved changes."
            : "Up to date."}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={reset} className="btn-ghost" disabled={busy}>
            <ReloadMark size={12} />
            <span>Reset to defaults</span>
          </button>
          <button
            onClick={save}
            disabled={!dirty || busy}
            className="btn-primary"
          >
            <QuillMark size={12} />
            <span>{busy ? "Saving" : "Save weights"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DimensionRow({
  label,
  body,
  value,
  onChange,
  disabled,
}: {
  label: string;
  body: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const pct = Math.round(value * 100);
  return (
    <div className="grid items-start gap-4 sm:grid-cols-[160px_1fr_80px]">
      <div>
        <p className="font-display text-[20px] leading-tight text-ink">{label}</p>
        <p className="mt-1 text-[12.5px] leading-snug text-ink/65">{body}</p>
      </div>

      <div className="flex items-center">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          className="brand-range w-full"
          aria-label={`${label} weight`}
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
          value={pct}
          disabled={disabled}
          onChange={(e) => {
            const v = Math.max(0, Math.min(100, Number(e.target.value) || 0));
            onChange(v / 100);
          }}
          className="input font-mono text-[13px] text-right"
          style={{ padding: "0.35rem 0.5rem" }}
          aria-label={`${label} weight percent`}
        />
        <span className="font-mono text-[12px] text-ink/55">%</span>
      </div>
    </div>
  );
}
