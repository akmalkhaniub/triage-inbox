// Shapes emitted by eval.py (results.json) and build_data.py (manifest.json)
// and by src/trajectories.py (per-trajectory JSON).

export interface ArmScore {
  precision: number;
  recall: number;
  f1: number;
  tp: number;
  fp: number;
  fn: number;
  action: string;
  error: string | null;
  tokens: { in: number; out: number };
  cost_usd: number;
}

export interface Aggregate {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  false_alarms_per_case: number;
  cost_per_task_usd: number;
  total_cost_usd: number;
}

export interface CaseRow {
  item_type: string;
  title: string;
  baseline?: ArmScore;
  agent?: ArmScore;
}

export interface Results {
  model: string;
  effort: string;
  n_cases: number;
  aggregate: { baseline?: Aggregate; agent?: Aggregate };
  per_case: Record<string, CaseRow>;
}

export interface ManifestEntry {
  agent: string;
  file: string;
  provider: string;
  model: string;
  in: number;
  out: number;
  steps: number;
}

export type Manifest = Record<string, Record<string, ManifestEntry[]>>;

export interface CaseMeta {
  item_type: string;
  title: string;
  ground_truth: unknown; // list (changelog) or map (review)
  artifact: Record<string, unknown>;
}
export type Cases = Record<string, CaseMeta>;

// Trajectory JSON
export interface ContentBlock {
  type: "text" | "tool_use" | "thinking";
  text?: string;
  thinking?: string;
  name?: string;
  input?: unknown;
  id?: string;
}

export interface TrajStep {
  kind: "model" | "tool";
  step: number;
  // model
  stop_reason?: string;
  content?: ContentBlock[];
  // tool
  name?: string;
  input?: unknown;
  result?: string;
  is_error?: boolean;
}

export interface Trajectory {
  agent: string;
  item_id: string;
  provider: string;
  model: string;
  system: string;
  input_tokens: number;
  output_tokens: number;
  steps: TrajStep[];
}
