"use client";

import { useEffect, useRef, useState } from "react";
import { deleteKB, getKBText, listKB, updateKB, uploadKB } from "@/lib/api";
import type { KBDocument } from "@/lib/types";
import {
  DiscardMark,
  EyeMark,
  PageMark,
  UploadMark,
} from "@/components/Marks";
import { EditorDrawer } from "@/components/EditorDrawer";

const ACCEPT = ".txt,.md,.markdown,.pdf,.docx";

export function KBUploader() {
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerBusy, setDrawerBusy] = useState(false);
  const [drawerText, setDrawerText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function refresh() {
    try {
      setDocs(await listKB());
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || (files as FileList).length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await uploadKB(Array.from(files));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteKB(id);
      if (openId === id) setOpenId(null);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function openDrawer(id: string) {
    setOpenId(id);
    setDrawerLoading(true);
    setError(null);
    try {
      const r = await getKBText(id);
      setDrawerText(r.text);
    } catch (e) {
      setError((e as Error).message);
      setOpenId(null);
    } finally {
      setDrawerLoading(false);
    }
  }

  async function saveDrawer(plainText: string) {
    if (!openId) return;
    setDrawerBusy(true);
    setError(null);
    try {
      await updateKB(openId, plainText);
      setDrawerText(plainText);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDrawerBusy(false);
    }
  }

  const totalBytes = docs.reduce((s, d) => s + d.bytes, 0);
  const totalChunks = docs.reduce((s, d) => s + d.chunks, 0);
  const openDoc = openId ? docs.find((d) => d.id === openId) : undefined;

  return (
    <div className="space-y-8">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`letter group cursor-pointer transition-colors ${
          dragOver ? "bg-wheat" : "hover:bg-wheat/50"
        }`}
      >
        <div className="flex flex-col items-center gap-4 py-6 text-center">
          <UploadMark size={28} className="text-ember" />
          <div>
            <p className="font-display text-[22px] italic leading-tight text-ink">
              Add to the library
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-ink/70">
              Drag and drop, or click anywhere on this card.
              <br />
              <span className="font-mono text-[11px] tracking-[0.05em]">
                .txt · .md · .pdf · .docx — 10 MB each
              </span>
            </p>
            <p className="mt-3 text-[12px] leading-relaxed text-ink/55">
              You can select{" "}
              <strong className="text-ink">multiple files</strong> at once
              (Cmd/Ctrl-click in the picker, or drop several here). Each upload{" "}
              <strong className="text-ink">appends</strong>.
            </p>
          </div>
          {busy && (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ember">
              · · · uploading · · ·
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <div className="border-l-2 border-[color:var(--rust)] bg-wheat/60 px-4 py-3 text-[13px] text-[color:var(--rust)]">
          {error}
        </div>
      )}

      {/* Library ledger */}
      <div>
        <div className="flex items-end justify-between border-b border-hairline pb-2">
          <p className="eyebrow">
            {docs.length === 0
              ? "Shelf is empty"
              : `${docs.length} on the shelf`}
          </p>
          {docs.length > 0 && (
            <p className="font-mono text-[11px] tracking-[0.12em] text-ink/60">
              {(totalBytes / 1024).toFixed(1)} KB · {totalChunks} chunks
            </p>
          )}
        </div>

        <ul>
          {docs.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 border-b border-hairline py-4 last:border-b-0"
            >
              <div className="flex min-w-0 items-start gap-4">
                <PageMark size={22} className="mt-0.5 shrink-0 text-ember" />
                <div className="min-w-0">
                  <button
                    onClick={() => openDrawer(d.id)}
                    className="truncate text-left font-display text-[18px] leading-tight text-ink hover:text-ember"
                  >
                    {d.filename}
                  </button>
                  <p className="mt-1 font-mono text-[11px] tracking-[0.05em] text-ink/55">
                    {d.chunks} chunk{d.chunks === 1 ? "" : "s"} ·{" "}
                    {(d.bytes / 1024).toFixed(1)} KB ·{" "}
                    <span className="text-ink/40">{d.id.slice(0, 8)}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openDrawer(d.id)}
                  className="btn-ghost"
                  aria-label={`Edit ${d.filename}`}
                >
                  <EyeMark size={14} />
                  <span>View · Edit</span>
                </button>
                <button
                  onClick={() => remove(d.id)}
                  className="btn-ghost text-[color:var(--rust)]"
                  aria-label={`Remove ${d.filename}`}
                >
                  <DiscardMark size={14} />
                  <span>Discard</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <EditorDrawer
        open={openId !== null}
        onClose={() => setOpenId(null)}
        title={openDoc?.filename ?? "Document"}
        subtitle={
          openDoc
            ? `${openDoc.chunks} chunk${openDoc.chunks === 1 ? "" : "s"} · ${(openDoc.bytes / 1024).toFixed(1)} KB · ${openDoc.id}`
            : undefined
        }
        initialText={drawerText}
        loading={drawerLoading}
        busy={drawerBusy}
        onSave={saveDrawer}
      />
    </div>
  );
}
