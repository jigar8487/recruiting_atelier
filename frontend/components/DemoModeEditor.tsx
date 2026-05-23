"use client";

import { useEffect, useState } from "react";
import { getDemoConfig, setDemoConfig } from "@/lib/api";
import type { DemoConfig } from "@/lib/types";
import { QuillMark, ReloadMark } from "@/components/Marks";

const PRESETS: { label: string; value: number; body: string }[] = [
  { label: "Off", value: 0, body: "No pacing — fastest end-to-end run." },
  { label: "Quick (2s)", value: 2, body: "A subtle gap; good for smaller demos." },
  { label: "Showcase (5s)", value: 5, body: "The default — read each agent's pill." },
  { label: "Patient (10s)", value: 10, body: "Slow for a deep walkthrough." },
];

export function DemoModeEditor() {
  const [cfg, setCfg] = useState<DemoConfig | null>(null);
  const [draft, setDraft] = useState<DemoConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    getDemoConfig()
      .then((c) => {
        setCfg(c);
        setDraft(c);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  function update(value: number) {
    if (draft === null) return;
    const clamped = Math.max(0, Math.min(30, value));
    setDraft({ delay_seconds: clamped });
    setSaved(null);
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const out = await setDemoConfig(draft);
      setCfg(out);
      setDraft(out);
      setSaved(new Date().toLocaleTimeString());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!cfg || !draft) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
        · loading demo config ·
      </p>
    );
  }

  const v = draft.delay_seconds;
  const dirty = cfg.delay_seconds !== v;
  const isOff = v === 0;

  return (
    <div className="space-y-6">
      {error && (
        <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          {error}
        </div>
      )}

      <p className="text-[13.5px] leading-relaxed text-ink/75">
        Inserts a pause between every agent stage so a live audience can
        follow what each specialist is doing.{" "}
        <span className="font-display italic text-ember">Kavya</span> also
        slows her per-candidate vet emits proportionally. Set to{" "}
        <strong>0</strong> to disable for the fastest end-to-end run.
      </p>

      {/* Big readout */}
      <div className="flex items-end gap-6 border-y border-hairline py-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/45">
            Pause between stages
          </p>
          <p className="mt-1 font-display text-[56px] leading-none text-ember">
            {isOff ? "—" : v}
            {!isOff && (
              <span className="ml-1 font-display text-[20px] italic text-ink/50">
                seconds
              </span>
            )}
          </p>
        </div>
        <span
          className={`pill ${
            isOff
              ? "border-ink/30 text-ink/55"
              : "pill-ember"
          }`}
        >
          {isOff ? "Off" : "Showcase mode"}
        </span>
      </div>

      {/* Presets */}
      <div className="grid gap-px bg-ink/15 sm:grid-cols-4">
        {PRESETS.map((p) => {
          const active = v === p.value;
          return (
            <button
              key={p.label}
              onClick={() => update(p.value)}
              disabled={busy}
              className={`px-4 py-3 text-left transition-colors ${
                active ? "bg-wheat" : "bg-cream hover:bg-wheat/60"
              }`}
            >
              <p className="font-display text-[18px] leading-tight text-ink">
                {p.label}
              </p>
              <p className="mt-1 text-[12px] leading-snug text-ink/65">
                {p.body}
              </p>
            </button>
          );
        })}
      </div>

      {/* Fine-tune */}
      <div className="grid items-center gap-4 sm:grid-cols-[160px_1fr_110px]">
        <p className="font-display text-[15px] leading-tight text-ink">
          Fine-tune (0 – 30 s)
        </p>
        <input
          type="range"
          min={0}
          max={30}
          step={1}
          value={v}
          disabled={busy}
          onChange={(e) => update(Number(e.target.value))}
          className="brand-range w-full"
          aria-label="Demo delay seconds"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={30}
            step={0.5}
            value={v}
            disabled={busy}
            onChange={(e) => update(Number(e.target.value) || 0)}
            className="input font-mono text-[13px] text-right"
            style={{ padding: "0.35rem 0.5rem" }}
            aria-label="Demo delay seconds (number)"
          />
          <span className="font-mono text-[12px] text-ink/55">s</span>
        </div>
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
          <button
            onClick={() => update(5)}
            className="btn-ghost"
            disabled={busy}
          >
            <ReloadMark size={12} />
            <span>Reset to 5s</span>
          </button>
          <button
            onClick={save}
            disabled={!dirty || busy}
            className="btn-primary"
          >
            <QuillMark size={12} />
            <span>{busy ? "Saving" : "Save pacing"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
