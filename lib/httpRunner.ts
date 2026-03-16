import type { HttpColumnConfig } from "./types";

function interpolate(template: string, data: Record<string, string>): { result: string; missing: string[] } {
  // Build case-insensitive lookup
  const lowerMap: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    lowerMap[k.toLowerCase()] = v;
  }
  const missing: string[] = [];
  const result = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = lowerMap[key.toLowerCase()];
    if (val === undefined || val === "") missing.push(key);
    return val ?? "";
  });
  return { result, missing };
}

function extractPath(obj: unknown, path: string): string {
  if (!path.trim()) return typeof obj === "string" ? obj : JSON.stringify(obj);
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return "";
    current = (current as Record<string, unknown>)[part];
  }
  if (current == null) return "";
  return typeof current === "string" ? current : JSON.stringify(current);
}

export interface HttpCellResult {
  value: string;
  success: boolean;
  error?: string;
  rawJson?: unknown;
}

export async function httpCell(
  config: HttpColumnConfig,
  rowData: Record<string, string>,
): Promise<HttpCellResult> {
  const urlInterp = interpolate(config.urlTemplate, rowData);
  if (urlInterp.missing.length > 0) {
    return { value: "", success: false, error: `Variable(s) manquante(s) : {{${urlInterp.missing.join("}}, {{")}}}` };
  }
  const url = urlInterp.result;
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(config.headers)) {
    headers[k] = interpolate(v, rowData).result;
  }
  const body = config.body ? interpolate(config.body, rowData).result : undefined;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch("/api/http-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          method: config.method,
          headers,
          body,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const is429 = json.status === 429 || json.error?.includes("429");
        if (is429 && attempt < 2) {
          const retryAfter = json.retryAfter ? Number(json.retryAfter) * 1000 : 2000 * (attempt + 1);
          await new Promise((r) => setTimeout(r, retryAfter));
          continue;
        }
        throw new Error(json.error || `HTTP ${res.status}`);
      }

      const value = extractPath(json.data, config.responsePath);
      return { value, success: true, rawJson: json.data };
    } catch (err) {
      if (attempt === 2) {
        return { value: "", success: false, error: (err as Error).message };
      }
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return { value: "", success: false, error: "Max retries (429 rate limit ?)" };
}

export interface RunHttpColumnOpts {
  config: HttpColumnConfig;
  columnId: string;
  columnNameToId: Record<string, string>;
  rows: { id: string; data: Record<string, string> }[];
  concurrency?: number;
  onCellStart: (rowId: string) => void;
  onCellDone: (rowId: string, value: string, rawJson?: unknown) => void;
  onCellError: (rowId: string, error: string) => void;
  shouldStop: () => boolean;
}

export async function runHttpColumn(opts: RunHttpColumnOpts): Promise<void> {
  const { config, columnNameToId, rows, concurrency = 2, onCellStart, onCellDone, onCellError, shouldStop } = opts;
  let nextIdx = 0;

  const worker = async () => {
    while (nextIdx < rows.length) {
      if (shouldStop()) return;
      const idx = nextIdx++;
      if (idx >= rows.length) return;
      const row = rows[idx];
      onCellStart(row.id);
      // Build a name-keyed data map so templates like {{Domain}} resolve correctly
      const namedData: Record<string, string> = { ...row.data };
      for (const [name, id] of Object.entries(columnNameToId)) {
        namedData[name] = row.data[id] || "";
      }
      const result = await httpCell(config, namedData);
      if (result.success) {
        onCellDone(row.id, result.value, result.rawJson);
      } else {
        onCellError(row.id, result.error || "Échoué");
      }
      // Delay between requests to respect rate limits
      await new Promise((r) => setTimeout(r, 350));
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
}
