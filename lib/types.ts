export type Provider = "anthropic" | "gemini";

export type AnthropicModelId =
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-5-20250929"
  | "claude-opus-4-5-20251101";

export type GeminiModelId =
  | "gemini-2.0-flash"
  | "gemini-2.5-flash"
  | "gemini-2.5-pro";

export type ModelId = AnthropicModelId | GeminiModelId;

export interface AnthropicModelConfig {
  name: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
  webSearchPer1K: number;
  toolOverheadTokens: number;
  recommended: boolean;
}

export interface GeminiModelConfig {
  name: string;
  label: string;
  inputPer1M: number;
  outputPer1M: number;
  groundingPer1K: number;
  freeGroundingPerDay: number;
  recommended: boolean;
}

export type SpeedTier = "fast" | "medium" | "slow";
export type QualityTier = "good" | "great" | "best";

export interface ModelGuidance {
  speed: SpeedTier;
  quality: QualityTier;
  bestFor: string;
  hasWebSearch: boolean;
}

export interface OutputColumn {
  key: string;
  label: string;
}

export interface ParsedFile {
  fileName: string;
  fileType: "xlsx" | "csv";
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export interface CostEstimate {
  totalRows: number;
  modelName: string;
  inputTokensPerRow: number;
  outputTokensPerRow: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  inputCost: number;
  outputCost: number;
  searchCost: number;
  totalCost: number;
  searchCostPerRow: number;
  freeSearchNote?: string;
}

export interface EnrichmentConfig {
  provider: Provider;
  apiKey: string;
  modelId: ModelId;
  inputColumns: string[];
  outputColumns: OutputColumn[];
  enrichmentDescription: string;
  customPrompt?: string;
}

export interface EnrichmentResult {
  rowIndex: number;
  success: boolean;
  data: Record<string, string>;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface RunProgress {
  total: number;
  completed: number;
  failed: number;
  running: boolean;
  paused: boolean;
  results: EnrichmentResult[];
  actualCost: number;
}

/* ------------------------------------------------------------------ */
/*  Sheet types (v2 spreadsheet UI)                                    */
/* ------------------------------------------------------------------ */

export type CellStatus = "idle" | "pending" | "running" | "done" | "error";

export interface EnrichmentColumnConfig {
  provider: Provider;
  modelId: ModelId;
  inputColumns: string[];
  description: string;
  customPrompt?: string;
  useWebSearch: boolean;
}

export interface HttpColumnConfig {
  urlTemplate: string; // e.g. "https://api.example.com/users/{{domain}}"
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string; // POST body template with {{placeholders}}
  responsePath: string; // JSON path e.g. "data.email" or "" for full response
}

export interface SheetColumn {
  id: string;
  name: string;
  type: "data" | "enrichment" | "http";
  width?: number;
  enrichmentConfig?: EnrichmentColumnConfig;
  httpConfig?: HttpColumnConfig;
}

export interface SheetRow {
  id: string;
  data: Record<string, string>;
  cellStatus: Record<string, CellStatus>;
  cellErrors: Record<string, string>;
  cellRawJson: Record<string, unknown>;
}

export type SheetAction =
  | { type: "IMPORT_CSV"; columns: string[]; rows: Record<string, string>[] }
  | { type: "ADD_ROW" }
  | { type: "ADD_ROWS_BULK"; rows: Record<string, string>[] }
  | { type: "UPDATE_CELL"; rowId: string; columnId: string; value: string }
  | { type: "DELETE_ROWS"; rowIds: string[] }
  | { type: "ADD_ENRICHMENT_COLUMN"; column: SheetColumn }
  | { type: "ADD_HTTP_COLUMN"; column: SheetColumn }
  | { type: "REMOVE_COLUMN"; columnId: string }
  | { type: "SET_CELL_STATUS"; rowId: string; columnId: string; status: CellStatus; error?: string }
  | { type: "SET_CELL_VALUE"; rowId: string; columnId: string; value: string; rawJson?: unknown }
  | { type: "EXTRACT_JSON_COLUMN"; sourceColumnId: string; jsonPath: string; columnName: string }
  | { type: "SET_API_KEY"; provider: Provider; key: string }
  | { type: "SET_KEY_VALID"; provider: Provider; valid: boolean }
  | { type: "CLEAR_ALL" }
  | { type: "RENAME_COLUMN"; columnId: string; newName: string }
  | { type: "RESIZE_COLUMN"; columnId: string; width: number }
  | { type: "REORDER_COLUMNS"; fromIndex: number; toIndex: number }
  | { type: "DUPLICATE_COLUMN"; columnId: string }
  | { type: "UPDATE_COLUMN_CONFIG"; columnId: string; updates: Partial<Pick<SheetColumn, "name" | "httpConfig" | "enrichmentConfig">> }
  | { type: "UNDO" }
  | { type: "REDO" };

export interface SelectionState {
  activeCell: { rowIndex: number; colIndex: number } | null;
  rangeEnd: { rowIndex: number; colIndex: number } | null;
  editing: boolean;
}

export interface SheetState {
  columns: SheetColumn[];
  rows: SheetRow[];
  apiKeys: Record<Provider, string>;
  keyValid: Record<Provider, boolean>;
}
