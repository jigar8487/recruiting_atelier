import { KBUploader } from "@/components/KBUploader";

export const metadata = { title: "Knowledge · Recruiting Atelier" };

export default function KBPage() {
  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Chapter III</p>
        <h1 className="headline mt-2 text-[44px] sm:text-[56px]">
          The <span className="italic">library</span>.
        </h1>
        <p className="deck mt-4 max-w-2xl">
          Job descriptions, interview guides, anything ruled. Held in memory
          for this session — when the process stops, the shelf empties. That
          is by design.
        </p>
      </header>
      <KBUploader />
    </div>
  );
}
