"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import { CloseMark, QuillMark } from "@/components/Marks";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  initialText: string;
  loading?: boolean;
  busy?: boolean;
  onSave: (plainText: string) => void | Promise<void>;
};

/**
 * Convert plain text (from the KB) into TipTap-friendly HTML.
 *
 * Many KB docs originate from PDFs whose extractors emit one fragment per
 * line — every word on its own paragraph. We repair that here:
 *   1. Split on blank-line paragraph boundaries
 *   2. Inside each paragraph, fold short consecutive lines back into prose
 *   3. Preserve bullets (•, -, 1.) and ALL-CAPS headings on their own lines
 */
function plainTextToHtml(s: string): string {
  if (!s) return "";
  const normalized = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n[ \t]*\n+/);
  const reflowed = blocks
    .map((b) => reflowBlock(b))
    .filter((b) => b.length > 0);

  // After per-block reflow, merge consecutive short paragraphs (< 60 chars
  // and not ending with sentence-terminating punctuation) to undo any
  // remaining over-fragmentation.
  const merged: string[] = [];
  for (const block of reflowed) {
    const last = merged[merged.length - 1];
    const lastShort = last && plainOf(last).length < 60 && !endsWithSentence(plainOf(last));
    const thisShort = plainOf(block).length < 60 && !startsWithBulletOrHeading(plainOf(block));
    if (last && lastShort && thisShort) {
      merged[merged.length - 1] = last + " " + block;
    } else {
      merged.push(block);
    }
  }
  return merged.map((b) => blockToHtml(b)).join("");
}

function reflowBlock(block: string): string {
  const lines = block
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  if (lines.length === 0) return "";
  const out: string[] = [];
  let buf = "";
  for (const line of lines) {
    const isBullet = /^([\-\*•●▪‣◦]|\d+[.)])\s+/.test(line);
    const isHeading = /^[A-Z][A-Z0-9 ,/&\-]{2,}$/.test(line) && line.length <= 80;
    if (isBullet || isHeading) {
      if (buf) {
        out.push(buf);
        buf = "";
      }
      out.push(line);
      continue;
    }
    if (!buf) {
      buf = line;
      continue;
    }
    if (/[.!?;:]["')\]]?\s*$/.test(buf) && /^[A-Z]/.test(line) && line.length > 40) {
      out.push(buf);
      buf = line;
    } else {
      buf = `${buf} ${line}`;
    }
  }
  if (buf) out.push(buf);
  return out.join("\n");
}

function blockToHtml(block: string): string {
  // Lines within a block become <br/> within a single <p>.
  return (
    "<p>" +
    block
      .split("\n")
      .map((line) => escapeHtml(line))
      .join("<br/>") +
    "</p>"
  );
}

function plainOf(block: string): string {
  return block.replace(/\n/g, " ");
}

function endsWithSentence(s: string): boolean {
  return /[.!?;:]["')\]]?\s*$/.test(s);
}

function startsWithBulletOrHeading(s: string): boolean {
  return (
    /^([\-\*•●▪‣◦]|\d+[.)])\s+/.test(s) ||
    (/^[A-Z][A-Z0-9 ,/&\-]{2,}$/.test(s) && s.length <= 80)
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function EditorDrawer({
  open,
  onClose,
  title,
  subtitle,
  initialText,
  loading,
  busy,
  onSave,
}: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Placeholder.configure({
        placeholder: "Begin typing…",
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose-editorial focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  // Load content whenever the drawer opens or initialText changes.
  useEffect(() => {
    if (!editor) return;
    if (!open) return;
    editor.commands.setContent(plainTextToHtml(initialText), false);
  }, [editor, open, initialText]);

  // ESC to close + body scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  async function commit() {
    if (!editor) return;
    const text = editor.getText({ blockSeparator: "\n\n" });
    await onSave(text);
  }

  return (
    <>
      {/* Backdrop — proper modal scrim */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{
          background: "rgba(52, 79, 31, 0.55)",
          backdropFilter: "blur(3px)",
          WebkitBackdropFilter: "blur(3px)",
        }}
      />

      {/* Drawer — opaque cream panel with strong elevation */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${title}`}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-[760px] flex-col transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        style={{
          background: "#F9F5F0",
          boxShadow:
            "-24px 0 60px -16px rgba(52, 79, 31, 0.45), -1px 0 0 0 rgba(52, 79, 31, 0.25)",
        }}
      >
        {/* Header */}
        <header className="border-b border-hairline px-8 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Editing</p>
              <h2 className="mt-1 truncate font-display text-[28px] leading-tight text-ink">
                {title}
              </h2>
              {subtitle && (
                <p className="mt-1 font-mono text-[11px] tracking-[0.08em] text-ink/55">
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="Close editor"
              className="btn-ghost"
            >
              <CloseMark size={14} />
              <span>Close</span>
            </button>
          </div>
        </header>

        {/* Toolbar */}
        {editor && <Toolbar editor={editor} disabled={busy || loading} />}

        {/* Editor body */}
        <div className="flex-1 overflow-y-auto bg-cream px-8 py-6">
          {loading ? (
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-ink/55">
              · fetching ·
            </p>
          ) : (
            <EditorContent editor={editor} />
          )}
        </div>

        {/* Footer */}
        <footer className="border-t border-hairline bg-wheat/50 px-8 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-[14px] italic text-ink/70">
              Committing re-chunks &amp; re-embeds — the doc id stays.
            </p>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn-ghost">
                <CloseMark size={12} />
                <span>Cancel</span>
              </button>
              <button
                onClick={commit}
                disabled={busy || loading}
                className="btn-primary"
              >
                <QuillMark size={12} />
                <span>{busy ? "Committing" : "Commit"}</span>
              </button>
            </div>
          </div>
        </footer>
      </aside>
    </>
  );
}

/* ----------- Toolbar ---------------------------------------------------- */

function Toolbar({
  editor,
  disabled,
}: {
  editor: Editor;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-hairline bg-cream px-6 py-2">
      <Group label="Style">
        <Btn
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          title="Bold"
        >
          <span className="font-display font-bold">B</span>
        </Btn>
        <Btn
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          title="Italic"
        >
          <span className="font-display italic">I</span>
        </Btn>
        <Btn
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          disabled={disabled}
          title="Underline"
        >
          <span className="font-display underline">U</span>
        </Btn>
        <Btn
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          disabled={disabled}
          title="Strikethrough"
        >
          <span className="font-display line-through">S</span>
        </Btn>
      </Group>

      <Divider />

      <Group label="Block">
        <Btn
          active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}
          disabled={disabled}
          title="Paragraph"
        >
          <span className="font-display">¶</span>
        </Btn>
        <Btn
          active={editor.isActive("heading", { level: 1 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          disabled={disabled}
          title="Heading 1"
        >
          <span className="font-display text-[15px]">
            H<sub className="text-[9px]">1</sub>
          </span>
        </Btn>
        <Btn
          active={editor.isActive("heading", { level: 2 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          disabled={disabled}
          title="Heading 2"
        >
          <span className="font-display text-[15px]">
            H<sub className="text-[9px]">2</sub>
          </span>
        </Btn>
        <Btn
          active={editor.isActive("heading", { level: 3 })}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          disabled={disabled}
          title="Heading 3"
        >
          <span className="font-display text-[15px]">
            H<sub className="text-[9px]">3</sub>
          </span>
        </Btn>
        <Btn
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          disabled={disabled}
          title="Blockquote"
        >
          <span className="font-display italic">&ldquo; &rdquo;</span>
        </Btn>
        <Btn
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          disabled={disabled}
          title="Code block"
        >
          <span className="font-mono text-[12px]">{`{ }`}</span>
        </Btn>
      </Group>

      <Divider />

      <Group label="List">
        <Btn
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          title="Bulleted list"
        >
          <span className="font-display">•</span>
        </Btn>
        <Btn
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          title="Numbered list"
        >
          <span className="font-mono text-[11px]">1.</span>
        </Btn>
      </Group>

      <Divider />

      <Group label="History">
        <Btn
          onClick={() => editor.chain().focus().undo().run()}
          disabled={disabled || !editor.can().undo()}
          title="Undo"
        >
          <span className="font-mono text-[11px]">↶</span>
        </Btn>
        <Btn
          onClick={() => editor.chain().focus().redo().run()}
          disabled={disabled || !editor.can().redo()}
          title="Redo"
        >
          <span className="font-mono text-[11px]">↷</span>
        </Btn>
      </Group>
    </div>
  );
}

function Group({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="group"
      aria-label={label}
    >
      {children}
    </div>
  );
}

function Btn({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`relative flex h-8 min-w-[34px] items-center justify-center px-2 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
        active
          ? "bg-ember/15 text-ember"
          : "text-ink/75 hover:bg-wheat hover:text-ink"
      }`}
      style={
        active
          ? { boxShadow: "inset 0 -2px 0 0 var(--ember)" }
          : undefined
      }
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-hairline" aria-hidden />;
}
