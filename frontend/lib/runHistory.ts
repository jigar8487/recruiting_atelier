/**
 * Past-scans history, persisted in localStorage so the /run screen can show
 * prior matches without a dedicated backend endpoint. Keyed per browser.
 *
 * v2 (atelier.runs.v2) adds per-candidate detail captured from SSE so the
 * candidate-detail drawer can render the full audit trail: Kavya's vet,
 * Anaya's screen, Diya's score + breakdown, Tara's rank, Riya's dispatch.
 */

const KEY = "atelier.runs.v2";
const LEGACY_KEY = "atelier.runs.v1"; // older records without candidate detail
const MAX_ROWS = 200;

export type ScoreBreakdown = {
  skills: number;
  experience: number;
  education: number;
  communication: number;
};

export type CandidateDetail = {
  candidate_id: string;
  /** Kavya — preflight duplicate check */
  vet?: {
    is_duplicate: boolean;
    matched_id?: string;
    matched_when?: string;
    reason?: string;
  };
  /** Anaya — pass/fail screen */
  screen?: {
    passed: boolean;
    reason?: string;
  };
  /** Diya — 0–100 overall + 4-dimension breakdown */
  score?: {
    overall: number;
    breakdown?: ScoreBreakdown;
    justification?: string;
  };
  /** Tara — final shortlist rank (1-based) or null if not picked */
  rank: number | null;
  in_shortlist: boolean;
};

export type ScannedCandidate = {
  candidate_id: string;
  score: number;
  breakdown?: ScoreBreakdown;
};

export type RunRecord = {
  run_id: string;
  created: string;
  job_id: string;
  jd_filename: string;
  jd_doc_id: string;
  cv_filenames: string[];
  results: ScannedCandidate[];      // top-N as ranked by Tara
  candidates?: CandidateDetail[];   // every candidate's per-agent trail (v2)
  tokens_in?: number;
  tokens_out?: number;
  cost_usd?: number;
  latency_ms?: number;
};

export function loadHistory(): RunRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data as RunRecord[];
    }
    // One-shot migrate v1 → v2 (no candidate detail; drawer will show a hint)
    const legacy = window.localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const data = JSON.parse(legacy);
      if (Array.isArray(data)) {
        window.localStorage.setItem(KEY, legacy);
        window.localStorage.removeItem(LEGACY_KEY);
        return data as RunRecord[];
      }
    }
    return [];
  } catch {
    return [];
  }
}

export function saveRun(record: RunRecord) {
  if (typeof window === "undefined") return;
  const cur = loadHistory();
  const next = [record, ...cur].slice(0, MAX_ROWS);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function removeRun(runId: string) {
  if (typeof window === "undefined") return;
  const next = loadHistory().filter((r) => r.run_id !== runId);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function findCandidate(
  records: RunRecord[],
  runId: string,
  candidateId: string,
): { record: RunRecord; detail: CandidateDetail | null } | null {
  const record = records.find((r) => r.run_id === runId);
  if (!record) return null;
  const detail =
    record.candidates?.find((c) => c.candidate_id === candidateId) ?? null;
  return { record, detail };
}
