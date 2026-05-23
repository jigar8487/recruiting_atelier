import { ToolsRegistryView } from "@/components/ToolsRegistryView";

export const metadata = { title: "Tools · Recruiting Atelier" };

export default function ToolsPage() {
  return (
    <div className="space-y-12">
      <header>
        <p className="eyebrow">Chapter V · Reference</p>
        <h1 className="headline mt-2 text-[44px] sm:text-[56px]">
          The <span className="italic">tool registry</span>.
        </h1>
        <p className="deck mt-4 max-w-2xl">
          Every external capability the agents reach for is declared here, by
          name. Two pieces: a JSON schema the model reads, and a Python
          function your code actually runs. The agent only sees the first.
        </p>
      </header>

      <ToolsRegistryView />
    </div>
  );
}
