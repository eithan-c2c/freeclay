import type { Provider, ModelId, AnthropicModelId, GeminiModelId, EnrichmentColumnConfig } from "./types";
import { buildPrompt } from "./promptTemplates";
import { enrichRowAnthropic } from "./anthropic";
import { enrichRowGemini } from "./gemini";

export interface EnrichCellResult {
  value: string;
  success: boolean;
  error?: string;
}

export async function enrichCell(
  apiKey: string,
  config: EnrichmentColumnConfig,
  rowData: Record<string, string>,
  columnName: string,
): Promise<EnrichCellResult> {
  const outputColumns = [{ key: columnName, label: columnName }];
  const prompt = buildPrompt(
    config.inputColumns,
    rowData,
    outputColumns,
    config.description,
    config.customPrompt,
    config.useWebSearch,
  );

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = config.provider === "anthropic"
        ? await enrichRowAnthropic(apiKey, config.modelId as AnthropicModelId, prompt, config.useWebSearch)
        : await enrichRowGemini(apiKey, config.modelId as GeminiModelId, prompt, config.useWebSearch);

      const value = result.data[columnName] || Object.values(result.data)[0] || "";
      return { value, success: true };
    } catch (err) {
      if (attempt === 2) {
        return { value: "", success: false, error: (err as Error).message };
      }
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return { value: "", success: false, error: "Max retries" };
}

export interface RunColumnOpts {
  apiKey: string;
  config: EnrichmentColumnConfig;
  columnId: string;
  columnName: string;
  rows: { id: string; data: Record<string, string> }[];
  concurrency?: number;
  onCellStart: (rowId: string) => void;
  onCellDone: (rowId: string, value: string) => void;
  onCellError: (rowId: string, error: string) => void;
  shouldStop: () => boolean;
}

export async function runColumnEnrichment(opts: RunColumnOpts): Promise<void> {
  const { apiKey, config, columnId: _, columnName, rows, concurrency = 3, onCellStart, onCellDone, onCellError, shouldStop } = opts;
  let nextIdx = 0;

  const worker = async () => {
    while (nextIdx < rows.length) {
      if (shouldStop()) return;
      const idx = nextIdx++;
      if (idx >= rows.length) return;
      const row = rows[idx];
      onCellStart(row.id);
      const result = await enrichCell(apiKey, config, row.data, columnName);
      if (result.success) {
        onCellDone(row.id, result.value);
      } else {
        onCellError(row.id, result.error || "Failed");
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
