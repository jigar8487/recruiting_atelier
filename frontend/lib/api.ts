import {
  DemoConfig,
  KBDocument,
  ProviderConfig,
  RunRequest,
  ScoringConfig,
  Shortlist,
  ToolEntry,
  UploadResult,
} from "./types";

const BASE = "/api/v1";

async function jfetch<T>(
  path: string,
  init: RequestInit | undefined,
  parse: (j: unknown) => T,
): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error?.message || r.statusText);
  }
  const j = await r.json();
  return parse(j);
}

// ---------- KB ----------

export async function uploadKB(files: File[]): Promise<UploadResult[]> {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const r = await fetch(`${BASE}/kb/upload`, { method: "POST", body: fd });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error?.message || r.statusText);
  }
  const j = await r.json();
  return UploadResult.array().parse(j);
}

export async function listKB(): Promise<KBDocument[]> {
  return jfetch("/kb/list", undefined, (j) => KBDocument.array().parse(j));
}

export async function deleteKB(docId: string): Promise<void> {
  await fetch(`${BASE}/kb/${docId}`, { method: "DELETE" });
}

export async function updateKB(
  docId: string,
  text: string,
  filename?: string,
): Promise<UploadResult> {
  return jfetch(`/kb/${encodeURIComponent(docId)}`,
    { method: "PUT", body: JSON.stringify({ text, filename }) },
    (j) => UploadResult.parse(j));
}

export async function getKBText(docId: string): Promise<{ doc_id: string; text: string }> {
  return jfetch(`/kb/${encodeURIComponent(docId)}/text`, undefined,
    (j) => j as { doc_id: string; text: string });
}

// ---------- Extract (one-off file → text, used by RunForm for PDF/DOCX) ----------

export async function extractText(
  file: File,
): Promise<{ text: string; warnings: string[]; filename: string }> {
  const fd = new FormData();
  fd.append("file", file);
  const r = await fetch(`${BASE}/extract`, { method: "POST", body: fd });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body?.error?.message || r.statusText);
  }
  return (await r.json()) as { text: string; warnings: string[]; filename: string };
}

// ---------- Settings ----------

export async function listProviders(): Promise<ProviderConfig[]> {
  return jfetch("/settings/providers", undefined,
    (j) => ProviderConfig.array().parse(j));
}

export async function getActiveProvider(): Promise<ProviderConfig> {
  return jfetch("/settings/provider", undefined, (j) => ProviderConfig.parse(j));
}

export async function setActiveProvider(cfg: ProviderConfig): Promise<ProviderConfig> {
  return jfetch("/settings/provider",
    { method: "PUT", body: JSON.stringify(cfg) },
    (j) => ProviderConfig.parse(j));
}

export async function getScoringConfig(): Promise<ScoringConfig> {
  return jfetch("/settings/scoring", undefined, (j) => ScoringConfig.parse(j));
}

export async function setScoringConfig(cfg: ScoringConfig): Promise<ScoringConfig> {
  return jfetch("/settings/scoring",
    { method: "PUT", body: JSON.stringify(cfg) },
    (j) => ScoringConfig.parse(j));
}

export async function getDemoConfig(): Promise<DemoConfig> {
  return jfetch("/settings/demo", undefined, (j) => DemoConfig.parse(j));
}

export async function setDemoConfig(cfg: DemoConfig): Promise<DemoConfig> {
  return jfetch("/settings/demo",
    { method: "PUT", body: JSON.stringify(cfg) },
    (j) => DemoConfig.parse(j));
}

// ---------- Run ----------

export async function startRun(req: RunRequest): Promise<{ run_id: string }> {
  const body = RunRequest.parse(req);
  return jfetch("/run", { method: "POST", body: JSON.stringify(body) },
    (j) => j as { run_id: string });
}

export function streamUrl(runId: string): string {
  return `${BASE}/run/${runId}/stream`;
}

// ---------- Tool registry ----------

export async function listTools(): Promise<ToolEntry[]> {
  return jfetch("/tools/list", undefined, (j) => ToolEntry.array().parse(j));
}

// ---------- Shortlists ----------

export async function getShortlists(jobId: string): Promise<Shortlist[]> {
  return jfetch(`/shortlists/${encodeURIComponent(jobId)}`, undefined,
    (j) => Shortlist.array().parse(j));
}
