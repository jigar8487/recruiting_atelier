"use client";

import { useEffect, useState } from "react";
import {
  getActiveProvider,
  listProviders,
  setActiveProvider,
} from "@/lib/api";
import type { ProviderConfig } from "@/lib/types";
import { CheckMark, AlertMark, QuillMark } from "@/components/Marks";

export function ProviderPicker() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [active, setActive] = useState<ProviderConfig | null>(null);
  const [chatModel, setChatModel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [list, act] = await Promise.all([
          listProviders(),
          getActiveProvider(),
        ]);
        setProviders(list);
        setActive(act);
        setChatModel(act.chat_model ?? "");
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  async function pick(p: ProviderConfig) {
    setBusy(true);
    setError(null);
    try {
      const cfg = await setActiveProvider({
        ...p,
        chat_model: chatModel || p.chat_model,
      });
      setActive(cfg);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          {error}
        </div>
      )}

      <div className="border-b border-hairline pb-2">
        <p className="eyebrow">Roster</p>
      </div>

      <div className="grid gap-px bg-ink/15 sm:grid-cols-2">
        {providers.map((p) => {
          const isActive = active?.name === p.name;
          return (
            <button
              key={p.name}
              onClick={() => pick(p)}
              disabled={!p.available || busy}
              className={`text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                isActive ? "bg-wheat" : "bg-cream hover:bg-wheat/60"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="eyebrow">
                      {isActive ? "Active" : "Roster"}
                    </p>
                    <h3 className="mt-1 font-display text-[24px] capitalize leading-none text-ink">
                      {p.name}
                    </h3>
                  </div>
                  {p.available ? (
                    <CheckMark size={16} className="text-ink" />
                  ) : (
                    <AlertMark
                      size={16}
                      className="text-[color:var(--rust)]"
                    />
                  )}
                </div>
                <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-[11px] text-ink/70">
                  <dt className="text-ink/45">endpoint</dt>
                  <dd>{p.base_url || "default"}</dd>
                  <dt className="text-ink/45">chat</dt>
                  <dd>{p.chat_model || "—"}</dd>
                  <dt className="text-ink/45">embed</dt>
                  <dd>{p.embed_model || "(fallback)"}</dd>
                </dl>
                {!p.available && (
                  <p className="mt-3 text-[12px] italic text-[color:var(--rust)]">
                    Set <span className="font-mono">{p.api_key_env}</span> in
                    backend/.env to enable.
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <div className="letter">
          <p className="eyebrow">Override</p>
          <h3 className="mt-1 font-display text-[24px] italic text-ink">
            Currently speaking:{" "}
            <span className="not-italic capitalize">{active.name}</span>
          </h3>
          <div className="mt-4">
            <label className="label" htmlFor="model">
              Override chat model
            </label>
            <input
              id="model"
              className="input font-mono"
              placeholder={active.chat_model ?? ""}
              value={chatModel}
              onChange={(e) => setChatModel(e.target.value)}
            />
          </div>
          <button
            onClick={() => pick(active)}
            disabled={busy}
            className="btn-primary mt-4"
          >
            <QuillMark size={12} />
            <span>{busy ? "Saving" : "Commit"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
