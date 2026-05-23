import { DemoModeEditor } from "@/components/DemoModeEditor";
import { ProviderPicker } from "@/components/ProviderPicker";
import { ScoringConfigEditor } from "@/components/ScoringConfigEditor";

export const metadata = { title: "Settings · Recruiting Atelier" };

export default function SettingsPage() {
  return (
    <div className="space-y-14">
      <header>
        <p className="eyebrow">Chapter VI</p>
        <h1 className="headline mt-2 text-[44px] sm:text-[56px]">
          The <span className="italic">voice, the scales &amp; the pacing</span>.
        </h1>
        <p className="deck mt-4 max-w-2xl">
          Three settings live here. Choose which model thinks out loud, tune
          the weights{" "}
          <span className="font-display not-italic text-ember">Diya</span>{" "}
          uses to weigh each candidate, and decide how slowly the agents
          should narrate themselves for a live audience.
        </p>
      </header>

      <section>
        <div className="mb-4 border-b border-hairline pb-2">
          <p className="eyebrow">I · The voice</p>
          <h2 className="mt-1 font-display text-[26px] italic leading-tight text-ink">
            Which model speaks?
          </h2>
        </div>
        <ProviderPicker />
      </section>

      <section>
        <div className="mb-4 border-b border-hairline pb-2">
          <p className="eyebrow">II · The scales</p>
          <h2 className="mt-1 font-display text-[26px] italic leading-tight text-ink">
            How is the match weighed?
          </h2>
        </div>
        <ScoringConfigEditor />
      </section>

      <section>
        <div className="mb-4 border-b border-hairline pb-2">
          <p className="eyebrow">III · The pacing</p>
          <h2 className="mt-1 font-display text-[26px] italic leading-tight text-ink">
            How fast should the agents go?
          </h2>
        </div>
        <DemoModeEditor />
      </section>
    </div>
  );
}
