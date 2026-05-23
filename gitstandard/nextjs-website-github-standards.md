# Recruiting Atelier — GitHub Development Standards

**File:** `gitstandard/nextjs-website-github-standards.md`
**Project:** Recruiting Atelier (`recruiting-atelier`) — monorepo
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind · TipTap · FastAPI · Python 3.11+ · MCP JSON-RPC
**Repo:** https://github.com/jigar8487/recruiting_atelier
**Author:** [Jigar Joshi](https://jigarjoshi.in)
**Owner:** [Wan Buffer Services](https://wanbuffer.com/) (connect@wanbuffer.com)
**License:** MIT (public)

**(Internal SOP — Mandatory Compliance Document)**

---

## 1. Purpose

This document defines **mandatory standards** for developing, managing, and deploying the **Recruiting Atelier** reference application — an end-to-end Agentic AI recruitment pipeline (planning → screen → score → shortlist → notify) with an editorial Next.js frontend, a FastAPI backend, and an MCP JSON-RPC sidecar.

**Related process docs (read together):**

| Document | Role |
| -------- | ---- |
| `README.md` | Project overview, tech stack, quick start, API reference, brand system |
| `doc/HR_Recruitment_Agent_Plan.md` | Full design (26 sections, per-file pseudocode, sequence diagrams) |
| `doc/HR_Recruitment_Agent_Requirements.docx` | Original requirements brief |
| `Makefile` | Canonical install / dev / test / acceptance commands |
| `gitstandard/nextjs-website-github-standards.md` | **This document** — branching, commits, PRs, quality bar |

Objectives:

* Keep the pipeline reproducible end-to-end with one canonical integration test
* Standardize **branching, naming, commits, and PRs** across frontend + backend
* Protect the **typed boundaries** (Pydantic on the wire, Zod on the client)
* Protect the **tool registry pattern** (`TOOLS list` / `TOOL_MAP dict` / `Tool function`)
* Keep secrets out of the public repo; keep PII out of the persistent stores
* Enable predictable collaboration between humans and agents on a monorepo

All **new work** ships through the standard `dev → stage → main` flow defined in Section 4. Hotfixes follow Section 12.

---

## 2. Tech Stack

### 2.1 Frontend (`frontend/`)

| Layer | Technology | Notes |
| ----- | ---------- | ----- |
| Framework | **Next.js 14** (App Router) | Client+server components, rewrites `/api/*` to FastAPI |
| Language | **TypeScript** | `tsconfig.json` strict; path alias `@/*` |
| UI | **React 18** | `"use client"` islands; SSR for non-interactive pages |
| Styling | **Tailwind CSS** | Brand tokens in `tailwind.config.ts`; raw CSS in `app/globals.css` for `.btn`, `.prose-editorial`, etc. |
| Icons | **Custom inline SVGs** in `components/Marks.tsx` | **No Lucide / Material / Heroicons.** Every glyph hand-drawn on a 24-grid |
| Fonts | **Source Serif 4**, **Inter Tight**, **JetBrains Mono** | Loaded via `next/font/google` in `app/layout.tsx` |
| Rich text | **TipTap** (`@tiptap/react`, `starter-kit`, `extension-underline`, `extension-placeholder`) | Word-style editor in `components/EditorDrawer.tsx` |
| Validation | **Zod** | Mirrors backend Pydantic schemas in `lib/types.ts` |
| Data fetching | **`fetch` via `lib/api.ts`** | Typed wrappers; `@tanstack/react-query` available but not required |
| Streaming | **EventSource** wrapper in `lib/sse.ts` | Consumes `/api/v1/run/{run_id}/stream` |

### 2.2 Backend (`backend/`)

| Layer | Technology | Notes |
| ----- | ---------- | ----- |
| Runtime | **Python 3.11+** | Pinned via `requirements.txt`; venv at `backend/.venv/` |
| HTTP API | **FastAPI + uvicorn** | Mounted under `/api/v1/`; OpenAPI at `/api/v1/docs` |
| Validation | **Pydantic v2** | Every agent + HTTP boundary typed |
| Vector store | **Chroma** (`EphemeralClient` for KB, persistent for shortlists) | KB resets on backend restart by design |
| LLM providers | **anthropic · openai · openrouter · NVIDIA NIM · local Ollama** | Switch at runtime from `/settings` |
| Embeddings | **Chroma all-MiniLM-L6-v2 (local)** or provider | `KB_EMBED_BACKEND=local\|provider` |
| Observability | **Langfuse** with print-fallback | `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` optional |
| File extraction | **pypdf**, **python-docx** | `services/text_extract.py` is the single entry point; PDF reflow step in `_reflow_pdf_text` |
| MCP | **Separate FastAPI JSON-RPC server on `:1813`** | `python -m mcp.server` — client auto-registers remote tools through the same registry |
| Agent cast | **Meera · Kavya · Anaya · Diya · Tara · Riya** | Meera supervises; Kavya is a preflight Vetter (duplicate detection); Anaya/Diya/Tara/Riya are the four main-loop specialists |
| Persistent runtime state | JSON files at repo root | `./.scoring-config.json` (Diya weights) · `./.demo-config.json` (pacing) · `./.seen-resumes.json` (Kavya dedup store) · `./.chroma-shortlists/` (Tara's history). **All gitignored.** |

### 2.3 Tool registry pattern (D3)

Every tool module declares three pieces, in this order:

```python
# 1. TOOLS list — what the LLM sees (JSON Schema)
TOOLS = [{"name": "...", "description": "...", "input_schema": {...}}, ...]

# 2. Tool functions — pure Python that does the real work
def parse_resume(resume_text: str, candidate_id: str | None = None) -> ResumeFields: ...

# 3. TOOL_MAP dict — name → function (the dispatcher)
TOOL_MAP = {"parse_resume": parse_resume, "score_candidate": score_candidate}

# 4. Wire it in (one-liner)
def register_into(registry):
    import sys; registry.register_module(sys.modules[__name__])
```

`ToolRegistry.register_module(module)` walks `TOOLS` and looks each name up in `TOOL_MAP`. Every agent calls tools via `registry.call("name", **kwargs)` and never imports tool functions directly. **New tools must follow this pattern** — descriptions are mandatory, every property gets its own `description`, and the `required` array must be explicit.

### 2.4 Not in stack (do not add without approval)

* Server-side rendering for the run page (must be client component due to SSE)
* Tailwind plugins beyond what's already configured
* Other icon libraries (Lucide / Material / Heroicons / Feather) — use `components/Marks.tsx`
* Other rich-text editors (Slate / Quill / Lexical) — TipTap is the chosen one
* Heavy JS animation libraries (Framer Motion / GSAP) — CSS keyframes only
* Replacing the in-memory KB with a persistent store (KB is intentionally ephemeral)
* Database migrations / ORMs — Chroma is the only persistent store and is file-based
* Adding a second package manager — `npm` for frontend, `pip` for backend

### 2.5 Canonical commands (must pass before promoting to `stage` / `main`)

```bash
# Backend
cd backend && . .venv/bin/activate
pytest -v                                     # full backend test suite
pytest tests/integration/test_canonical_run.py -v   # the must-pass smoke

# Frontend
cd frontend
npm run lint
npm run build                                 # `.next/` produced; no TS errors

# End-to-end local
make dev                                      # starts API:1812, MCP:1813, web:3000
```

---

## 3. Repository Strategy

### 3.1 Single monorepo

```
recruiting-atelier
├── backend/        # Python · FastAPI · MCP server · agents · tools
├── frontend/       # Next.js 14 · TS · Tailwind · TipTap
├── doc/            # Design plan + requirements
├── gitstandard/    # This SOP
├── Makefile
├── README.md
└── LICENSE         # MIT
```

The two sides ship together. Frontend and backend changes can land in one PR if they're part of the same feature (e.g. a new endpoint + the page that consumes it).

### 3.2 What belongs in this repo

| In scope | Out of scope / never commit |
| -------- | --------------------------- |
| `backend/**/*.py`, `frontend/**/*.{ts,tsx}`, `doc/**/*.md`, `Makefile`, `*.example` | `.env`, `.env.*` (except `.env.example`), `.env.bak`, anything matching `*.bak` |
| `backend/data/` sample JD + resumes (already public-safe) | API keys (Anthropic / OpenAI / OpenRouter / NVIDIA / Langfuse) |
| `backend/tests/`, `backend/data/` | `backend/.venv/`, `frontend/node_modules/`, `frontend/.next/` |
| `package.json`, `package-lock.json`, `requirements.txt`, `tsconfig.json`, `tailwind.config.ts`, `next.config.mjs` | `.chroma-shortlists/`, `.chroma/`, `.ollama/`, `.DS_Store`, `*.swp`, `*~` |

The hardened `.gitignore` already covers all of the above. **Do not loosen it.**

### 3.3 License & visibility

* **Public** repo, **MIT** license. Anything you commit ships to the world.
* Resume content in `backend/data/` is fictional sample data — do not replace with real PII.
* The `Co-Authored-By:` line in commit messages is optional but encouraged when an AI assistant contributed materially.

---

## 4. Branching Strategy (Mandatory)

### 4.1 Production (live)

```
main
```

* Tagged releases live here (`v0.x.y`)
* ❌ No direct development
* ✅ Merges only from `stage` (or authorized hotfix branch — Section 12)

### 4.2 Staging (pre-release QA)

```
stage
```

* Receives merges from `dev` after the integration test + lint + build pass
* Used for any manual UAT against a real LLM provider before cutting a release

### 4.3 Development (integration)

```
dev
```

* Primary integration branch
* All feature work targets this branch first
* Must pass `pytest tests/integration/test_canonical_run.py` and `npm run build` before promotion

### 4.4 Mapping

| Branch | Purpose | Required green checks |
| ------ | ------- | --------------------- |
| `dev` | Integration | `pytest` smoke · `npm run lint` · `npm run build` |
| `stage` | UAT against real provider | All of `dev` checks · 1 successful end-to-end run from `/run` |
| `main` | Release | All of `stage` checks · CHANGELOG note · tag pushed |

---

## 5. Feature Branch Naming

### 5.1 Preferred (simple)

```
feature/<scope>-<short-kebab-description>
```

`<scope>` is one of `frontend`, `backend`, `agent`, `tool`, `mcp`, `kb`, `run`, `tools-page`, `infra`, `docs`.

Examples:

```
feature/frontend-editor-drawer-tiptap
feature/backend-extract-endpoint
feature/tool-add-fetch-linkedin
feature/kb-rich-text-edit
feature/docs-readme-rename
```

PR target: **`dev`**.

### 5.2 Strict format (optional, for audit trails)

```
{keyword}/{scope}-{feature-title}-{prefix}
```

* **keyword** → see table below
* **scope** → `frontend` | `backend` | `agent` | `tool` | `mcp` | `kb` | `run` | `infra` | `docs`
* **feature-title** → kebab-case
* **prefix** → 3-letter developer ID (e.g. `jig`)

Example: `feat/backend-tool-registry-pattern-jig`

### 5.3 Allowed keywords

| Keyword | Usage |
| ------- | ----- |
| feat | New feature, new page, new tool, new endpoint |
| fix | Non-urgent bug fix |
| hotfix | Urgent production fix (see Section 12) |
| refactor | Code restructuring; no behavior change |
| improv | Enhancement of an existing capability |
| cleanup | Remove dead code / unused files |
| a11y | Accessibility |
| brand | Visual / type / palette changes |
| perf | Performance |
| content | Sample data, prompts, rubrics |
| chore | Tooling, deps, config |
| docs | Documentation only |
| test | New or updated tests |
| sec | Security — secret rotation, gitignore, dependency audit |
| release | Release preparation, version bumps, tag |

---

## 6. Project Folder Structure

```
recruiting-atelier/
├── backend/
│   ├── runner.py                 # Top-level ReAct loop
│   ├── api/
│   │   ├── app.py                # FastAPI factory; mounts every router under /api/v1
│   │   ├── kb_routes.py          # upload · list · get-text · PUT edit · DELETE
│   │   ├── extract_routes.py     # POST /extract — file → text (used by /run)
│   │   ├── run_routes.py         # POST /run, SSE stream, summary, trace
│   │   ├── shortlist_routes.py
│   │   ├── settings_routes.py
│   │   ├── tool_routes.py        # GET /tools/list
│   │   └── errors.py
│   ├── agents/                   # supervisor + screener + scorer + shortlister + notifier
│   ├── tools/
│   │   ├── registry.py           # ToolRegistry · register_module()
│   │   ├── resume_tools.py       # TOOLS + TOOL_MAP + parse_resume / score_candidate
│   │   └── comm_tools.py         # TOOLS + TOOL_MAP + send_email / schedule_interview
│   ├── memory/                   # Session (short-term) + persistent shortlists (Chroma)
│   ├── rag/
│   │   └── knowledge_base.py     # In-memory KB; ingest · update_text · remove
│   ├── llm/                      # 5 provider adapters + factory
│   ├── mcp/                      # JSON-RPC server + client
│   ├── production/               # schemas (Pydantic), observability, guardrails
│   ├── services/text_extract.py  # .txt / .md / .pdf / .docx → plain text
│   ├── tests/                    # FakeLLM + canonical integration smoke test
│   ├── data/                     # Sample JD, sample resumes, interview guide
│   ├── .env.example              # Template — keys must be empty
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── layout.tsx            # Masthead · footer · next/font/google
│   │   ├── globals.css           # Brand tokens · .btn / .prose-editorial / .letter
│   │   ├── page.tsx              # /
│   │   ├── kb/page.tsx           # /kb
│   │   ├── run/page.tsx          # /run
│   │   ├── tools/page.tsx        # /tools
│   │   ├── settings/page.tsx     # /settings
│   │   └── shortlist/[jobId]/    # /shortlist/<id>
│   ├── components/
│   │   ├── Nav.tsx, Footer.tsx, Marks.tsx
│   │   ├── KBUploader.tsx, EditorDrawer.tsx
│   │   ├── CVUploader.tsx, RunHistoryTable.tsx
│   │   ├── RunStream.tsx, Timeline.tsx
│   │   ├── ProviderPicker.tsx, ShortlistTable.tsx
│   │   └── ToolsRegistryView.tsx
│   ├── lib/
│   │   ├── api.ts                # Typed fetchers
│   │   ├── sse.ts                # SSE helper
│   │   ├── types.ts              # Zod (mirrors Pydantic)
│   │   └── runHistory.ts         # localStorage past-scans
│   ├── tailwind.config.ts        # Brand palette + font families
│   ├── next.config.mjs           # Rewrites /api/* → http://localhost:1812
│   ├── .env.example
│   └── package.json
├── doc/
│   ├── HR_Recruitment_Agent_Plan.md         # Full design (26 sections)
│   └── HR_Recruitment_Agent_Requirements.docx
├── gitstandard/
│   └── nextjs-website-github-standards.md   # This document
├── Makefile
├── README.md
└── LICENSE
```

**Rules:**

* New **routes** → `frontend/app/<route>/page.tsx`. Client components if SSE or browser APIs are involved.
* New **API endpoints** → `backend/api/<area>_routes.py`, mounted in `backend/api/app.py`.
* New **agents** → `backend/agents/<name>_agent.py`; constructor must take `(session, registry, run_id)`.
* New **tools** → either extend `backend/tools/resume_tools.py` / `comm_tools.py` *or* create a new `<scope>_tools.py` module that exports `TOOLS` + `TOOL_MAP` (Section 2.3).
* New **types** crossing the wire → Pydantic in `backend/production/schemas.py` **and** Zod mirror in `frontend/lib/types.ts`. They must stay in sync.
* New **icons** → add to `frontend/components/Marks.tsx`. Hand-drawn 24-grid, 1.25px stroke, rounded ends. Never import an icon library.
* ❌ Do not add API routes that bypass `/api/v1/` prefix
* ❌ Do not commit `.venv/`, `node_modules/`, `.next/`, `.env`, `.env.bak`, `.chroma-shortlists/`, or any file ending in `*.bak` / `*.orig` / `*~`

---

## 7. Mandatory Quality & Security

### 7.1 Static-HTML / SEO

Not applicable. This is an **application**, not a marketing site. Pages render client-side as needed (the run page uses SSE; the KB page mounts a TipTap editor). No sitemap, no robots, no JSON-LD.

### 7.2 Typed boundaries

Every value crossing an HTTP boundary must be validated:

| Direction | Backend | Frontend |
| --------- | ------- | -------- |
| Request body | Pydantic model in `production/schemas.py` | `RunRequest.parse(...)` in `lib/api.ts` before send |
| Response body | Pydantic `response_model=` on the FastAPI route | Zod `.parse()` in `lib/api.ts` after receive |
| SSE event | `RunEvent` Pydantic model | `RunEvent` Zod schema |

When you add a field, update **both** schemas in the same PR.

### 7.3 Tool registry compliance

Every new tool entry must:

* Live in a module that exports `TOOLS` (list of dicts) and `TOOL_MAP` (dict of name → callable)
* Have a `description` of at least 80 characters that says *when* to use the tool (not just what)
* Have a `description` on every property in `input_schema.properties`
* Have an explicit `required` array (even if empty)
* Be registered via `registry.register_module(module)` — never call `register(...)` ad-hoc

The canonical integration test will fail if a registered tool's schema is incomplete in a way that breaks the agent's prompt.

### 7.4 Secrets & PII

* All API keys live in `backend/.env` (gitignored). The corresponding `backend/.env.example` keeps the variable names with **empty values** so contributors know what to provide.
* Never commit a real Langfuse public/secret key pair, even "test" ones.
* Never replace `backend/data/` resumes with real candidate data, even temporarily.
* If you discover a leaked key in the repo (or a `.env.bak` / `.env.orig`), **rotate it immediately** and add the matching pattern to `.gitignore`.

### 7.5 Environment variables

Backend (`backend/.env`, template in `.env.example`):

| Variable | Purpose |
| -------- | ------- |
| `LLM_CHAT_PROVIDER` | Default chat provider (`anthropic` \| `openai` \| `openrouter` \| `nvidia` \| `local`) |
| `LLM_EMBED_PROVIDER` | Provider for embeddings when the chat provider doesn't support them |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `NVIDIA_API_KEY` | Provider credentials |
| `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` / `LANGFUSE_HOST` | Optional observability |
| `API_PORT` (default `1812`) | FastAPI port |
| `MCP_PORT` (default `1813`) | MCP server port |
| `FRONTEND_ORIGIN` (default `http://localhost:3000`) | CORS allowlist origin |
| `MAX_ITERATIONS` (default `10`) | ReAct loop ceiling |
| `TOP_N` (default `3`) | Default shortlist size |
| `KB_MAX_BYTES` (default `512 MB`) | In-memory KB ceiling |
| `KB_EMBED_BACKEND` (default `local`) | `local` Chroma default vs `provider` adapter |
| `SHORTLIST_CHROMA_PATH` (default `./.chroma-shortlists`) | Persistent shortlist directory |

Frontend (`frontend/.env.example`):

| Variable | Purpose |
| -------- | ------- |
| `NEXT_PUBLIC_API_BASE` (default `http://localhost:1812`) | Backend base URL; consumed by `next.config.mjs` rewrites |

❌ Never commit secrets. The gitignore is the second line of defense — the first is your eyes during `git status`.

---

## 8. Versioning Standards

| Concept | Format | Example |
| ------- | ------ | ------- |
| **Git branches** | `main` / `stage` / `dev` / `feature/*` | n/a |
| **package.json** | Semver | `"version": "0.1.0"`; bump on user-visible changes |
| **Git tag** | `vMAJOR.MINOR.PATCH` | `v0.2.0` on a `main` cut |
| **Backend FastAPI version** | Matches package.json major.minor | `version="1.0.0"` in `api/app.py` |

When promoting to production:

1. Merge `stage` → `main`
2. Bump `frontend/package.json` version
3. Tag the merge commit `v0.x.y`
4. Push the tag

---

## 9. License & Repository Policy

* **Public** repository, **MIT** license. See `LICENSE`.
* Respect npm and PyPI dependency licenses. If you add a dependency, confirm it's MIT/BSD/Apache-2-compatible.
* Sample data in `backend/data/` is fictional and freely redistributable — do not replace with real candidate PII.
* No client-identifying anecdotes in commit messages or PR descriptions.

---

## 10. Commit & PR Message Standards

### 10.1 Commit format (primary)

```
<area>: <short imperative title>
```

**Areas:** `backend` | `frontend` | `agent` | `tool` | `mcp` | `kb` | `run` | `docs` | `infra` | `chore` | `feat` | `fix` | `test` | `sec`

Examples:

```
backend: add POST /api/v1/extract for one-off file extraction
frontend: replace inline KB editor with right-side TipTap drawer
tool: tighten parse_resume description and require resume_text
agent: emit run.complete payload with candidate scores
infra: harden .gitignore for *.env.bak / *.bak
docs: rewrite README for Recruiting Atelier rename
sec: rotate OpenRouter key referenced by .env.bak
```

Body: explain **why**, not only what.

### 10.2 Optional strict prefix (developer IDs)

```
jig-feat: add /tools page with anatomy + pattern + live registry
```

### 10.3 AI co-author trailer

When an AI assistant contributed materially, append a trailer:

```

Co-Authored-By: Claude <noreply@anthropic.com>
```

(Optional but encouraged.)

---

## 11. PR Description Template

```
Summary:
Brief overview of the change.

Issue / goal:
What problem this solves or which milestone it advances.

Changes:
- Backend
  - api/<router>.py — endpoint added / changed
  - tools/<module>.py — TOOLS / TOOL_MAP / function added
  - production/schemas.py — Pydantic model added/updated
- Frontend
  - app/<route>/page.tsx — new route or restructure
  - components/<Component>.tsx — new or restructured
  - lib/types.ts — Zod mirror updated
  - lib/api.ts — typed fetcher added
- Docs
  - README.md / doc/* updates

Type:
hotfix | feature | fix | refactor | improvement | docs | brand | test | chore | sec

Testing:
- [ ] backend: `pytest -v` — pass
- [ ] backend: `pytest tests/integration/test_canonical_run.py -v` — pass
- [ ] frontend: `npm run lint` — pass
- [ ] frontend: `npm run build` — pass (no TS errors)
- [ ] Manual: `make dev` and exercise the affected flow
- [ ] If tool schema changed: `GET /api/v1/tools/list` shows the new description + required array
- [ ] If wire types changed: backend Pydantic + frontend Zod stay in sync
- [ ] If UI changed: desktop + mobile layouts checked; keyboard focus visible

Deployment notes:
- New env vars added to `.env.example` (and to README §Configuration)
- Ports unchanged (or note: API_PORT, MCP_PORT, frontend dev port)
- Migration / data implications (none for in-memory KB; shortlists may need `.chroma-shortlists/` cleanup)
```

---

## 12. Merge Flow (Strict)

```
Feature branch (feature/<scope>-... or feat/<scope>-...-<prefix>)
        ↓
       dev
        ↓
      stage
        ↓
       main  →  tagged vX.Y.Z
```

* No skipping stages without explicit approval in the PR thread.
* **Hotfix** path: branch from `main` as `hotfix/<scope>-<description>`, fix, PR directly into `main` AND open a backport PR into `dev` and `stage` so they don't drift.
* The canonical integration test (`tests/integration/test_canonical_run.py`) **must pass** at every stage gate.

---

## 13. Code Quality Standards

### 13.1 Frontend

* **TypeScript:** strict mode. No `any` without a justified comment. Prefer narrow types over `unknown` casts.
* **Components:** Server components by default; `"use client"` only when you need hooks, refs, browser APIs, or SSE.
* **Imports:** Use `@/` alias (`@/components/Marks`, `@/lib/api`).
* **Styling:** Tailwind utility classes first; brand utilities (`.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`, `.input`, `.label`, `.eyebrow`, `.deck`, `.headline`, `.letter`, `.card`, `.card-wheat`) defined in `globals.css`. Don't inline `style={{}}` except for dynamic values (drawer transforms, runtime-computed widths).
* **Icons:** `components/Marks.tsx` only. Never `lucide-react` or any other icon set.
* **Accessibility:** Semantic HTML, alt text on `<img>`, visible focus rings (already styled via `:focus-visible`), keyboard-operable buttons. The right-side editor drawer must close on ESC.
* **Editorial tone:** Headlines in Source Serif 4, italic where it serves the brand. No emojis in UI strings (the brand is deliberately serious).

### 13.2 Backend

* **Python 3.11+** — use `str | None` over `Optional[str]`, `list[X]` over `List[X]`.
* **Typed return values** — every public function returns a typed result (Pydantic model or a primitive).
* **Pydantic schemas** in `backend/production/schemas.py` only — don't redefine the same shape elsewhere.
* **Tool functions** stay pure: validate inputs, call `factory.traced_chat()` / `factory.traced_embed()`, return a typed result. Side effects (logging, caching) are fine; network and file I/O outside the factory are not.
* **Error paths** in routes return `APIException(...)` so the standard error envelope ships uniformly.
* **No silent swallowing** of LLM errors in agent code — the guardrails layer retries up to 3× and then surfaces.

### 13.3 Cross-cutting

* **One feature per PR** — don't bundle an unrelated refactor.
* **Tests for behavior changes** — extend `tests/integration/test_canonical_run.py` or add a focused test.
* **No drive-by reformatting** — keep diffs reviewable.

---

## 14. Final Compliance Checklist (before `main`)

### Repository & branching

* [ ] Flow: `dev` → `stage` → `main` honored
* [ ] No direct commits on `main`
* [ ] Feature branch naming acceptable (Section 5)
* [ ] No `.env`, `.env.*` (except `.example`), `.bak`, `*.orig`, `.venv/`, `node_modules/`, `.next/`, `.chroma*/` staged

### Build & quality

* [ ] `pytest -v` passes
* [ ] `pytest tests/integration/test_canonical_run.py -v` passes
* [ ] `npm run lint` passes
* [ ] `npm run build` passes — no TypeScript errors
* [ ] Canonical end-to-end run works locally via `make dev`

### Structure & scope

* [ ] Backend changes inside `backend/`; frontend changes inside `frontend/`
* [ ] New endpoints under `/api/v1/` and registered in `api/app.py`
* [ ] New tools follow the **TOOLS + TOOL_MAP + register_into** pattern
* [ ] Wire types: Pydantic and Zod stay in sync

### Brand & UI (if frontend touched)

* [ ] No new icon-library imports — `Marks.tsx` only
* [ ] Uses brand colors / fonts / utilities, not ad-hoc hex codes
* [ ] Buttons use `.btn-primary` / `.btn` / `.btn-ghost` / `.btn-danger` (no custom button styles)
* [ ] Right-side drawer interactions remain accessible (ESC, focus trap acceptable, backdrop click closes)

### Security

* [ ] No secrets committed
* [ ] `.env.example` updated if a new env var was introduced
* [ ] `README.md` § Configuration mentions any new env var
* [ ] If a key was ever printed in logs or commit history, it has been **rotated**

### Commits & PRs

* [ ] Commit messages follow Section 10
* [ ] PR uses Section 11 template
* [ ] AI co-author trailer added when applicable

### Release (only when promoting `stage` → `main`)

* [ ] `frontend/package.json` version bumped
* [ ] Tag pushed (`vX.Y.Z`)
* [ ] CHANGELOG.md updated (if present)
* [ ] Tag verifies on https://github.com/<org>/recruiting-atelier/releases

---

## 15. Enforcement

This SOP is mandatory. Deviations risk:

* **Broken pipeline:** A tool schema missing a `description` or a `required` array degrades agent decision-making and can break the canonical test.
* **Leaked secrets:** A committed `.env.bak` leaks an LLM provider key — the only fix is rotation, which costs the team time and breaks any active runs.
* **Drift between TS and Python:** A Pydantic field changed without a Zod mirror update silently breaks SSE consumers or POST bodies.
* **Brand erosion:** Adding `lucide-react` or another icon set fragments the visual language the project was deliberately designed around.

When in doubt: stop, ask in the PR, prefer a smaller change.

---

**End of Document**
