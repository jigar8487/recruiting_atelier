import { z } from "zod";

export const KBDocument = z.object({
  id: z.string(),
  filename: z.string(),
  mime: z.string(),
  uploaded: z.string(),
  chunks: z.number(),
  bytes: z.number(),
});
export type KBDocument = z.infer<typeof KBDocument>;

export const UploadResult = z.object({
  doc_id: z.string(),
  filename: z.string(),
  chunks: z.number(),
  bytes: z.number(),
  warnings: z.array(z.string()).default([]),
});
export type UploadResult = z.infer<typeof UploadResult>;

export const ProviderConfig = z.object({
  name: z.enum(["anthropic", "openai", "openrouter", "nvidia", "local", "fake"]),
  chat_model: z.string().nullable().optional(),
  embed_model: z.string().nullable().optional(),
  base_url: z.string().nullable().optional(),
  api_key_env: z.string().nullable().optional(),
  available: z.boolean().default(true),
});
export type ProviderConfig = z.infer<typeof ProviderConfig>;

export const ResumeInput = z.object({
  candidate_id: z.string(),
  text: z.string(),
});
export type ResumeInput = z.infer<typeof ResumeInput>;

export const RunRequest = z.object({
  job_id: z.string(),
  job_description: z.string(),
  resumes: z.array(ResumeInput),
  top_n: z.number().int().min(1).max(10).default(3),
  max_iterations: z.number().int().min(1).max(20).default(10),
  temperature: z.number().min(0).max(2).default(0.7),
  provider: z.string().nullable().optional(),
  chat_model: z.string().nullable().optional(),
  recipient: z.string().default("hiring.manager@company.com"),
});
export type RunRequest = z.infer<typeof RunRequest>;

export const RunStage = z.enum([
  "think", "vet", "screen", "score", "shortlist", "notify", "run", "llm",
]);
export type RunStage = z.infer<typeof RunStage>;

export const RunEventType = z.enum([
  "start", "chunk", "complete", "error", "warning", "retry", "token",
]);
export type RunEventType = z.infer<typeof RunEventType>;

export const RunEvent = z.object({
  run_id: z.string(),
  step: z.number(),
  stage: RunStage,
  event: RunEventType,
  payload: z.record(z.unknown()).default({}),
  ts: z.string(),
});
export type RunEvent = z.infer<typeof RunEvent>;

export const CandidateScore = z.object({
  candidate_id: z.string(),
  score: z.number(),
});

export const Shortlist = z.object({
  job_id: z.string(),
  candidates: z.array(CandidateScore),
  created: z.string(),
});
export type Shortlist = z.infer<typeof Shortlist>;

export const ToolEntry = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.record(z.unknown()),
  source: z.enum(["local", "mcp"]),
});
export type ToolEntry = z.infer<typeof ToolEntry>;

export const ScoringConfig = z.object({
  weight_skills: z.number().min(0).max(1),
  weight_experience: z.number().min(0).max(1),
  weight_education: z.number().min(0).max(1),
  weight_communication: z.number().min(0).max(1),
});
export type ScoringConfig = z.infer<typeof ScoringConfig>;

export const DemoConfig = z.object({
  delay_seconds: z.number().min(0).max(30),
});
export type DemoConfig = z.infer<typeof DemoConfig>;
