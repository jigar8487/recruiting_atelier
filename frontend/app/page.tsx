import Link from "next/link";
import { OutwardMark } from "@/components/Marks";

const CAST = [
  { person: "Meera", role: "Supervisor" },
  { person: "Kavya", role: "Vetter" },
  { person: "Anaya", role: "Screener" },
  { person: "Diya", role: "Scorer" },
  { person: "Tara", role: "Shortlister" },
  { person: "Riya", role: "Notifier" },
];

const chapters = [
  {
    href: "/workflow",
    num: "I.",
    title: "Understand the loop",
    body: "Meet the cast — Kavya the Vetter (preflight duplicate-catcher), Meera the Supervisor who plans, and her four specialists: Anaya the Screener, Diya the Scorer, Tara the Shortlister, Riya the Notifier. A diagram, six phases, and a worked example.",
    cta: "See the workflow",
  },
  {
    href: "/settings",
    num: "II.",
    title: "Choose the voice",
    body: "Five providers, one switch. Anthropic, OpenAI, OpenRouter, NVIDIA NIM, or a local Ollama. The agent speaks through whichever you trust.",
    cta: "Configure provider",
  },
  {
    href: "/kb",
    num: "III.",
    title: "Furnish the library",
    body: "Drop job descriptions and interview guides into the knowledge base. They are chunked, embedded, and held for the lifetime of the process.",
    cta: "Open the library",
  },
  {
    href: "/run",
    num: "IV.",
    title: "Watch the work",
    body: "Screen, score, shortlist, notify — four hands working at one bench, narrating themselves over a server-sent stream. You stay; they decide.",
    cta: "Begin a run",
  },
  {
    href: "/tools",
    num: "V.",
    title: "Inspect the tools",
    body: "The Anatomy of a tool schema · the Registry pattern · the live list of every tool Meera can reach for, local and remote.",
    cta: "Read the registry",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero — magazine cover */}
      <section className="grid items-end gap-6 sm:grid-cols-[1fr_auto]">
        <div>
          <p className="eyebrow">Issue 01 · Spring 2026 · Agentic AI</p>
          <h1 className="headline mt-3 text-[58px] sm:text-[80px]">
            The
            <span className="italic"> recruiting </span>
            <br className="hidden sm:block" />
            <span className="text-ember">atelier</span>.
          </h1>
          <p className="deck mt-5 max-w-xl">
            A working reference for an end-to-end agentic pipeline.{" "}
            <span className="font-display not-italic text-ember">Kavya</span>{" "}
            vets the field for duplicates;{" "}
            <span className="font-display not-italic text-ember">Meera</span>{" "}
            plans what remains; her four specialists —{" "}
            <span className="font-display not-italic text-ember">Anaya</span>,{" "}
            <span className="font-display not-italic text-ember">Diya</span>,{" "}
            <span className="font-display not-italic text-ember">Tara</span>, and{" "}
            <span className="font-display not-italic text-ember">Riya</span> —
            carry it out. Read it, run it, take it apart.
          </p>
        </div>
        <aside className="card-wheat hidden w-72 sm:block">
          <p className="eyebrow">Contents</p>
          <ol className="mt-3 space-y-2 font-display text-[16px] text-ink">
            <li>
              <span className="font-mono text-[11px] text-ink/50">i.</span>{" "}
              Workflow
            </li>
            <li>
              <span className="font-mono text-[11px] text-ink/50">ii.</span>{" "}
              Provider
            </li>
            <li>
              <span className="font-mono text-[11px] text-ink/50">iii.</span>{" "}
              Knowledge
            </li>
            <li>
              <span className="font-mono text-[11px] text-ink/50">iv.</span>{" "}
              Run
            </li>
            <li>
              <span className="font-mono text-[11px] text-ink/50">v.</span>{" "}
              Tools
            </li>
          </ol>
        </aside>
      </section>

      <div className="asterism" />

      {/* Five chapters — 3 + 2 grid */}
      <section className="space-y-6">
        <p className="eyebrow">Five chapters</p>
        <div className="grid gap-px bg-ink/15 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((c, idx) => (
            <Link
              key={c.href}
              href={c.href}
              className={`group flex flex-col justify-between bg-cream p-6 transition-colors hover:bg-wheat ${
                idx === 0 ? "lg:col-span-2" : ""
              }`}
            >
              <div>
                <span className="font-display text-[34px] italic leading-none text-ember">
                  {c.num}
                </span>
                <h3 className="mt-3 font-display text-[22px] leading-tight text-ink">
                  {c.title}
                </h3>
                <p className="mt-3 text-[14px] leading-relaxed text-ink/75">
                  {c.body}
                </p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-ink group-hover:text-ember">
                {c.cta}
                <OutwardMark size={11} />
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Meet the cast — tiny strip */}
      <section className="space-y-3">
        <div className="border-b border-hairline pb-2">
          <p className="eyebrow">Meet the cast</p>
        </div>
        <ul className="grid gap-px bg-ink/15 sm:grid-cols-5">
          {CAST.map((c, idx) => (
            <li key={c.person} className="bg-cream px-4 py-3">
              <p className="font-mono text-[10px] tracking-[0.22em] text-ink/45">
                {idx === 0 ? "LEAD" : `0${idx}`}
              </p>
              <p className="mt-1.5 font-display text-[20px] leading-none text-ember">
                {c.person}
              </p>
              <p className="mt-0.5 font-display text-[12px] italic text-ink/65">
                the {c.role}
              </p>
            </li>
          ))}
        </ul>
        <p className="pt-1 text-[12.5px] italic text-ink/60">
          A full breakdown lives in{" "}
          <Link
            href="/workflow"
            className="border-b border-ember/60 text-ember hover:border-ember"
          >
            the workflow chapter
          </Link>
          .
        </p>
      </section>

      {/* Attribution — Presented by · Built by · Guidance by */}
      <section className="border-t border-hairline pt-10">
        <div className="grid gap-10 sm:grid-cols-3">
          <div>
            <p className="eyebrow">Presented by</p>
            <p className="mt-2 font-display text-[22px] leading-tight text-ink">
              Dezal Hadiya
            </p>
            <a
              href="https://wanbuffer.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-0.5 inline-block font-display text-[14px] italic text-ink/65 hover:text-ember"
            >
              Wan Buffer Services
            </a>
          </div>

          <div>
            <p className="eyebrow">Built by</p>
            <p className="mt-2 font-display text-[22px] leading-tight text-ink">
              Agentic AI Team
            </p>
            <a
              href="https://wanbuffer.com/"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-0.5 inline-block font-display text-[14px] italic text-ink/65 hover:text-ember"
            >
              Wan Buffer Services
            </a>
          </div>

          <div>
            <p className="eyebrow">Guidance by</p>
            <a
              href="https://jigarjoshi.in"
              target="_blank"
              rel="noreferrer noopener"
              className="mt-2 inline-flex items-center gap-1.5 font-display text-[22px] leading-tight text-ink hover:text-ember"
            >
              Jigar Joshi
              <OutwardMark size={12} />
            </a>
            <p className="mt-0.5 font-display text-[14px] italic text-ink/65">
              jigarjoshi.in
            </p>
          </div>
        </div>

        <p className="mt-8 max-w-3xl text-[13.5px] leading-relaxed text-ink/70">
          This is a study, not a service. No auth, no rate limit, no PII
          retention. Carry the patterns into your own product; leave the
          scaffolding here.
        </p>
      </section>
    </div>
  );
}
