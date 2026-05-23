import { ShortlistTable } from "@/components/ShortlistTable";

type Props = { params: { jobId: string } };

export function generateMetadata({ params }: Props) {
  return { title: `Shortlists · ${params.jobId}` };
}

export default function ShortlistPage({ params }: Props) {
  return (
    <div className="space-y-10">
      <header>
        <p className="eyebrow">Appendix · History</p>
        <h1 className="headline mt-2 text-[40px] sm:text-[52px]">
          Past shortlists for{" "}
          <span className="font-mono text-[28px] italic text-ember">
            {params.jobId}
          </span>
          .
        </h1>
        <p className="deck mt-4 max-w-2xl">
          Persisted on disk between sessions — the only thing the agent keeps.
        </p>
      </header>
      <ShortlistTable jobId={params.jobId} />
    </div>
  );
}
