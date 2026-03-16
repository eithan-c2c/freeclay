"use client";

import { useState, useRef, useEffect } from "react";
import { useSheet, useSheetDispatch } from "@/lib/sheetStore";
import type { SheetColumn, HttpColumnConfig } from "@/lib/types";
import { X, Globe, Copy } from "lucide-react";

/* ---------- Curl parser ---------- */
function parseCurl(raw: string): { method: string; url: string; headers: Record<string, string>; body?: string } | null {
  const s = raw.replace(/\\\n/g, " ").trim();
  if (!s) return null;
  let method = "GET";
  const headers: Record<string, string> = {};
  let url = "";
  let body: string | undefined;

  const tokens: string[] = [];
  const re = /'([^']*)'|"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    tokens.push(m[1] ?? m[2] ?? m[3]);
  }

  let i = 0;
  if (tokens[0]?.toLowerCase() === "curl") i = 1;

  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "-X" || t === "--request") {
      method = (tokens[++i] || "GET").toUpperCase();
    } else if (t === "-H" || t === "--header") {
      const hVal = tokens[++i] || "";
      const colonIdx = hVal.indexOf(":");
      if (colonIdx > 0) {
        headers[hVal.slice(0, colonIdx).trim()] = hVal.slice(colonIdx + 1).trim();
      }
    } else if (t === "-d" || t === "--data" || t === "--data-raw" || t === "--data-binary") {
      body = tokens[++i] || "";
      if (method === "GET") method = "POST";
    } else if (!t.startsWith("-") && !url) {
      url = t;
    }
    i++;
  }

  return url ? { method, url, headers, body } : null;
}

/* ---------- Rebuild curl from config ---------- */
function configToCurl(config: HttpColumnConfig): string {
  let curl = `curl '${config.urlTemplate}'`;
  if (config.method === "POST") curl = `curl -X POST '${config.urlTemplate}'`;
  for (const [k, v] of Object.entries(config.headers)) {
    curl += ` -H '${k}: ${v}'`;
  }
  if (config.body) curl += ` -d '${config.body}'`;
  return curl;
}

/* ---------- Examples ---------- */
const EXAMPLES = [
  {
    label: "Hunter.io",
    curl: `curl 'https://api.hunter.io/v2/domain-search?domain={{domain}}&api_key=YOUR_KEY'`,
    path: "data.emails.0.value",
  },
  {
    label: "Clearbit",
    curl: `curl -H 'Authorization: Bearer YOUR_KEY' 'https://company.clearbit.com/v2/companies/find?domain={{domain}}'`,
    path: "name",
  },
  {
    label: "API custom",
    curl: `curl 'https://api.example.com/lookup?q={{company}}'`,
    path: "",
  },
];

let _colId = 0;

interface Props {
  open: boolean;
  onClose: () => void;
  editColumn?: SheetColumn | null;
}

export default function AddHttpColumnModal({ open, onClose, editColumn }: Props) {
  const sheet = useSheet();
  const dispatch = useSheetDispatch();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const dataColumns = sheet.columns.filter((c) => c.type === "data");

  const [name, setName] = useState("");
  const [curl, setCurl] = useState("");
  const [responsePath, setResponsePath] = useState("");

  // Pre-fill when editing
  useEffect(() => {
    if (open && editColumn?.httpConfig) {
      setName(editColumn.name);
      setCurl(configToCurl(editColumn.httpConfig));
      setResponsePath(editColumn.httpConfig.responsePath);
    } else if (open && !editColumn) {
      setName("");
      setCurl("");
      setResponsePath("");
    }
  }, [open, editColumn]);

  if (!open) return null;

  const parsed = parseCurl(curl);
  const isValid = !!(name.trim() && parsed?.url);
  const isEditing = !!editColumn;

  const handleSubmit = () => {
    if (!parsed?.url || !name.trim()) return;

    const config: HttpColumnConfig = {
      urlTemplate: parsed.url,
      method: (parsed.method === "POST" ? "POST" : "GET") as "GET" | "POST",
      headers: parsed.headers,
      body: parsed.body || undefined,
      responsePath: responsePath.trim(),
    };

    if (isEditing) {
      dispatch({ type: "UPDATE_COLUMN_CONFIG", columnId: editColumn.id, updates: { name: name.trim(), httpConfig: config } });
    } else {
      const colId = `http_${++_colId}_${Date.now().toString(36)}`;
      const column: SheetColumn = {
        id: colId,
        name: name.trim(),
        type: "http",
        httpConfig: config,
      };
      dispatch({ type: "ADD_HTTP_COLUMN", column });
    }

    onClose();
  };

  const insertVariable = (varName: string) => {
    const ta = textareaRef.current;
    if (!ta) {
      setCurl((prev) => prev + `{{${varName}}}`);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const insert = `{{${varName}}}`;
    const next = curl.slice(0, start) + insert + curl.slice(end);
    setCurl(next);
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + insert.length, start + insert.length);
    }, 0);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border-2 border-[#04261A] bg-white shadow-[6px_6px_0px_#04261A]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#04261A]/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#00DF82]" />
            <h3 className="text-sm font-semibold text-[#04261A]">{isEditing ? "Modifier la colonne HTTP" : "Colonne HTTP"}</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#04261A]/40 hover:bg-[#04261A]/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {/* Column name */}
          <div>
            <label className="text-xs font-medium text-[#04261A]/60">Nom de la colonne</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Email, Score, Infos..."
              className="mt-1 w-full rounded-lg border-2 border-[#04261A]/10 bg-[#F4F9F9] px-3 py-2 text-sm text-[#04261A] outline-none placeholder:text-[#04261A]/30 focus:border-[#00DF82]"
              autoFocus
            />
          </div>

          {/* Curl input */}
          <div>
            <label className="text-xs font-medium text-[#04261A]/60">Colle ton curl ici</label>
            <textarea
              ref={textareaRef}
              value={curl}
              onChange={(e) => setCurl(e.target.value)}
              placeholder={`curl 'https://api.example.com/search?domain={{domain}}'`}
              rows={4}
              className="mt-1 w-full rounded-lg border-2 border-[#04261A]/10 bg-[#F4F9F9] px-3 py-2 text-sm font-mono text-[#04261A] outline-none placeholder:text-[#04261A]/30 focus:border-[#00DF82]"
            />

            {/* Variable chips */}
            {dataColumns.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-[#04261A]/40">Insère :</span>
                {dataColumns.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => insertVariable(col.name)}
                    className="flex items-center gap-0.5 rounded-full border border-[#C8F05B]/60 bg-[#C8F05B]/20 px-2 py-0.5 text-[10px] font-mono font-medium text-[#04261A]/70 transition hover:bg-[#C8F05B]/40 hover:text-[#04261A]"
                  >
                    <Copy className="h-2.5 w-2.5" />
                    {col.name}
                  </button>
                ))}
              </div>
            )}

            {/* Live parse preview */}
            {parsed && (
              <div className="mt-2 rounded-lg border border-[#00DF82]/30 bg-[#00DF82]/5 px-3 py-2">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="rounded bg-[#04261A] px-1.5 py-0.5 font-mono font-bold text-white">{parsed.method}</span>
                  <span className="truncate font-mono text-[#04261A]/70">{parsed.url}</span>
                </div>
                {Object.keys(parsed.headers).length > 0 && (
                  <div className="mt-1 text-[10px] text-[#04261A]/40">
                    {Object.keys(parsed.headers).length} en-tête(s)
                  </div>
                )}
                {parsed.body && (
                  <div className="mt-1 text-[10px] text-[#04261A]/40">Body inclus</div>
                )}
              </div>
            )}
          </div>

          {/* Examples — only in create mode */}
          {!isEditing && (
            <div>
              <label className="text-xs font-medium text-[#04261A]/60">Exemples</label>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex.label}
                    onClick={() => {
                      setCurl(ex.curl);
                      setResponsePath(ex.path);
                      if (!name.trim()) setName(ex.label);
                    }}
                    className="rounded-full border border-[#04261A]/10 px-2.5 py-1 text-[10px] text-[#04261A]/50 transition hover:border-[#00DF82]/50 hover:bg-[#00DF82]/5 hover:text-[#04261A]"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Response path */}
          <div>
            <label className="text-xs font-medium text-[#04261A]/60">Chemin JSON (optionnel)</label>
            <input
              value={responsePath}
              onChange={(e) => setResponsePath(e.target.value)}
              placeholder="ex: data.email — vide = réponse complète"
              className="mt-1 w-full rounded-lg border-2 border-[#04261A]/10 bg-[#F4F9F9] px-3 py-2 text-sm font-mono text-[#04261A] outline-none placeholder:text-[#04261A]/30 focus:border-[#00DF82]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[#04261A]/10 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-[#04261A]/15 px-4 py-2 text-xs font-medium text-[#04261A]/50 transition hover:bg-[#04261A]/5">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={!isValid}
            className="rounded-lg bg-[#00DF82] px-4 py-2 text-xs font-semibold text-[#04261A] shadow-[3px_3px_0px_#04261A] transition hover:shadow-[1px_1px_0px_#04261A] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-40 disabled:shadow-none"
          >
            {isEditing ? "Sauvegarder" : "Lancer la colonne"}
          </button>
        </div>
      </div>
    </div>
  );
}
