"use client";

import { OutwardMark } from "@/components/Marks";

export function Footer() {
  const year = new Date().getFullYear();

  function onSiteClick() {
    if (typeof window !== "undefined" && "gtag" in window) {
      // @ts-expect-error optional tag handler
      window.gtag?.("event", "footer_author_click", {
        destination: "jigarjoshi.in",
      });
    }
  }

  return (
    <footer className="mt-20 border-t border-hairline">
      <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-md">
            <p className="eyebrow">Colophon</p>
            <p className="mt-2 font-display text-[20px] italic leading-snug text-ink">
              Set in <span className="not-italic">Source&nbsp;Serif&nbsp;4</span>,
              {" "}<span className="not-italic">Inter&nbsp;Tight</span>, and
              {" "}<span className="not-italic">JetBrains&nbsp;Mono</span>.
              Pressed on cream and wheat; ruled in olive; struck in ember.
            </p>
          </div>

          <div className="space-y-2 sm:text-right">
            <p className="eyebrow">Author</p>
            <a
              href="https://jigarjoshi.in"
              target="_blank"
              rel="noreferrer noopener"
              onClick={onSiteClick}
              className="inline-flex items-center gap-1.5 font-display text-[18px] text-ink hover:text-ember"
            >
              Jigar Joshi
              <OutwardMark size={11} />
            </a>
            <p className="font-mono text-[11px] tracking-[0.15em] text-ink/60">
              MIT · ISSUE {year}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
