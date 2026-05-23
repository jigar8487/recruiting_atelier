"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DiamondMark, Monogram } from "@/components/Marks";

const links = [
  { href: "/", label: "Index", num: "01" },
  { href: "/workflow", label: "Workflow", num: "02" },
  { href: "/kb", label: "Knowledge", num: "03" },
  { href: "/run", label: "Run", num: "04" },
  { href: "/tools", label: "Tools", num: "05" },
  { href: "/settings", label: "Settings", num: "06" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-hairline">
      <div className="mx-auto flex max-w-5xl items-end justify-between gap-6 px-6 pb-3 pt-5 sm:px-10">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Recruiting Atelier — Home"
        >
          <Monogram size={32} className="text-ink" />
          <div className="leading-none">
            <div className="eyebrow">An Agentic Studio</div>
            <div className="font-display text-[26px] leading-none tracking-wordmark text-ink">
              Recruiting{" "}
              <span className="italic text-ember">Atelier</span>
            </div>
          </div>
        </Link>

        <nav className="hidden items-end gap-6 sm:flex">
          {links.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group flex flex-col items-end leading-none"
              >
                <span className="font-mono text-[10px] tracking-[0.18em] text-ink/50">
                  {l.num}
                </span>
                <span
                  className={`mt-1 flex items-center gap-1.5 font-display text-[15px] ${
                    active ? "text-ember" : "text-ink"
                  }`}
                >
                  {active && <DiamondMark size={6} className="text-ember" />}
                  <span
                    className={
                      active
                        ? "border-b border-ember"
                        : "border-b border-transparent group-hover:border-ink/40"
                    }
                  >
                    {l.label}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Double-rule masthead detail */}
      <div className="mx-auto max-w-5xl px-6 sm:px-10">
        <div className="border-t border-hairline" />
      </div>

      {/* Mobile nav */}
      <nav className="mx-auto flex max-w-5xl items-center gap-4 overflow-x-auto px-6 py-2 sm:hidden">
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
                active ? "text-ember" : "text-ink/60"
              }`}
            >
              {l.num} {l.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
