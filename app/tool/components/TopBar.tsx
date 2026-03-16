"use client";

import { useState, useRef } from "react";
import { useSheet, useSheetDispatch, useUndoInfo } from "@/lib/sheetStore";
import { parseFile } from "@/lib/fileParser";
import type { Provider } from "@/lib/types";
import { Upload, Download, Key, Check, Loader2, X, Undo2, Redo2 } from "lucide-react";
import Papa from "papaparse";
import { useToast } from "./Toast";

export default function TopBar() {
  const sheet = useSheet();
  const dispatch = useSheetDispatch();
  const { canUndo, canRedo } = useUndoInfo();
  const fileRef = useRef<HTMLInputElement>(null);
  const [validating, setValidating] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyProvider, setKeyProvider] = useState<Provider>("anthropic");
  const [keyDraft, setKeyDraft] = useState("");
  const { toast } = useToast();

  const handleFile = async (f: File) => {
    if (f.size > 10 * 1024 * 1024) { toast("Le fichier dépasse la limite de 10 Mo.", "error"); return; }
    try {
      const parsed = await parseFile(f);
      if (parsed.totalRows === 0) { toast("Le fichier est vide.", "error"); return; }
      dispatch({ type: "IMPORT_CSV", columns: parsed.columns, rows: parsed.rows });
      toast(`${parsed.totalRows} lignes importées`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  };

  const validateKey = async () => {
    if (!keyDraft.trim()) { setKeyError("Entre une clé API"); return; }
    setValidating(true); setKeyError("");
    try {
      const res = await fetch("/api/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: keyProvider, apiKey: keyDraft.trim() }),
      });
      const data = await res.json();
      if (data.valid) {
        dispatch({ type: "SET_API_KEY", provider: keyProvider, key: keyDraft.trim() });
        dispatch({ type: "SET_KEY_VALID", provider: keyProvider, valid: true });
        setShowKeyInput(false);
        setKeyDraft("");
        toast(`Clé ${keyProvider === "anthropic" ? "Anthropic" : "Gemini"} validée`, "success");
      } else {
        setKeyError(data.error || "Clé invalide");
      }
    } catch {
      setKeyError("Validation échouée");
    } finally {
      setValidating(false);
    }
  };

  const handleExport = (format: "csv" | "json") => {
    if (sheet.rows.length === 0) return;
    const colHeaders = sheet.columns.map((c) => c.name);
    const data = sheet.rows.map((row) => {
      const obj: Record<string, string> = {};
      for (const col of sheet.columns) obj[col.name] = row.data[col.id] || "";
      return obj;
    });

    let blob: Blob;
    let ext: string;
    if (format === "json") {
      blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      ext = "json";
    } else {
      const csv = Papa.unparse(data, { columns: colHeaders });
      blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      ext = "csv";
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `freegtm_export.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(`Export ${format.toUpperCase()} téléchargé`, "success");
  };

  const hasAnthropicKey = sheet.keyValid.anthropic;
  const hasGeminiKey = sheet.keyValid.gemini;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#04261A]/10 bg-white px-3 py-2 shadow-sm">
      {/* Import CSV */}
      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-1.5 rounded-lg bg-[#00DF82] px-3 py-1.5 text-xs font-semibold text-[#04261A] shadow-[3px_3px_0px_#04261A] transition hover:shadow-[1px_1px_0px_#04261A] hover:translate-x-[2px] hover:translate-y-[2px] active:shadow-none"
      >
        <Upload className="h-3.5 w-3.5" /> Importer CSV
      </button>
      <input
        ref={fileRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        className="hidden"
      />

      {/* Undo/Redo */}
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => dispatch({ type: "UNDO" })}
          disabled={!canUndo}
          className="rounded p-1 text-[#04261A]/40 transition hover:bg-[#04261A]/5 hover:text-[#04261A] disabled:opacity-25 disabled:hover:bg-transparent"
          title="Annuler (Ctrl+Z)"
        >
          <Undo2 className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => dispatch({ type: "REDO" })}
          disabled={!canRedo}
          className="rounded p-1 text-[#04261A]/40 transition hover:bg-[#04261A]/5 hover:text-[#04261A] disabled:opacity-25 disabled:hover:bg-transparent"
          title="Rétablir (Ctrl+Y)"
        >
          <Redo2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mx-1 h-5 w-px bg-[#04261A]/10" />

      {/* API Key indicators */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => { setKeyProvider("anthropic"); setShowKeyInput(true); setKeyDraft(sheet.apiKeys.anthropic); setKeyError(""); }}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
            hasAnthropicKey ? "bg-[#00DF82]/15 text-[#04261A] ring-1 ring-[#00DF82]/40" : "bg-[#04261A]/5 text-[#04261A]/50 ring-1 ring-[#04261A]/10 hover:ring-[#04261A]/20"
          }`}
        >
          {hasAnthropicKey ? <Check className="h-2.5 w-2.5" /> : <Key className="h-2.5 w-2.5" />}
          Claude
        </button>
        <button
          onClick={() => { setKeyProvider("gemini"); setShowKeyInput(true); setKeyDraft(sheet.apiKeys.gemini); setKeyError(""); }}
          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
            hasGeminiKey ? "bg-[#00DF82]/15 text-[#04261A] ring-1 ring-[#00DF82]/40" : "bg-[#04261A]/5 text-[#04261A]/50 ring-1 ring-[#04261A]/10 hover:ring-[#04261A]/20"
          }`}
        >
          {hasGeminiKey ? <Check className="h-2.5 w-2.5" /> : <Key className="h-2.5 w-2.5" />}
          Gemini
        </button>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Export */}
        {sheet.rows.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExport("csv")}
              className="flex items-center gap-1 rounded-lg border border-[#04261A]/10 px-2.5 py-1.5 text-[10px] font-medium text-[#04261A]/50 transition hover:bg-[#04261A]/5 hover:text-[#04261A]/80"
            >
              <Download className="h-3 w-3" /> CSV
            </button>
            <button
              onClick={() => handleExport("json")}
              className="flex items-center gap-1 rounded-lg border border-[#04261A]/10 px-2.5 py-1.5 text-[10px] font-medium text-[#04261A]/50 transition hover:bg-[#04261A]/5 hover:text-[#04261A]/80"
            >
              <Download className="h-3 w-3" /> JSON
            </button>
          </div>
        )}

        {/* Row count */}
        {sheet.rows.length > 0 && (
          <span className="text-[10px] text-[#04261A]/40">{sheet.rows.length} lignes</span>
        )}
      </div>

      {/* Key input modal */}
      {showKeyInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={() => setShowKeyInput(false)}>
          <div className="w-full max-w-md rounded-2xl border-2 border-[#04261A] bg-white p-6 shadow-[6px_6px_0px_#04261A]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#04261A]">
                Clé API {keyProvider === "anthropic" ? "Anthropic" : "Google Gemini"}
              </h3>
              <button onClick={() => setShowKeyInput(false)} className="rounded p-1 text-[#04261A]/40 hover:bg-[#04261A]/5">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1 text-xs text-[#04261A]/50">
              Ta clé reste uniquement dans la mémoire du navigateur. Jamais stockée ni loggée.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type="password"
                placeholder={keyProvider === "anthropic" ? "sk-ant-..." : "AIza..."}
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && validateKey()}
                className="flex-1 rounded-lg border-2 border-[#04261A]/15 bg-[#F4F9F9] px-3 py-2 text-sm text-[#04261A] outline-none placeholder:text-[#04261A]/30 focus:border-[#00DF82]"
                autoFocus
              />
              <button
                onClick={validateKey}
                disabled={validating}
                className="flex items-center gap-1.5 rounded-lg bg-[#00DF82] px-4 py-2 text-sm font-semibold text-[#04261A] shadow-[3px_3px_0px_#04261A] transition hover:shadow-[1px_1px_0px_#04261A] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-50"
              >
                {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                Valider
              </button>
            </div>
            {keyError && <p className="mt-2 text-xs text-red-500">{keyError}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
