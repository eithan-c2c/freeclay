"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronDown, Plus, Copy, Braces, Hash, Type, List } from "lucide-react";
import { useSheetDispatch } from "@/lib/sheetStore";
import { useToast } from "./Toast";

interface Props {
  data: unknown;
  sourceColumnId: string;
  onClose: () => void;
}

function getType(value: unknown): "object" | "array" | "string" | "number" | "boolean" | "null" {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as "object" | "string" | "number" | "boolean";
}

function getTypeIcon(type: ReturnType<typeof getType>) {
  switch (type) {
    case "object": return <Braces className="h-3 w-3 text-purple-500" />;
    case "array": return <List className="h-3 w-3 text-blue-500" />;
    case "string": return <Type className="h-3 w-3 text-green-600" />;
    case "number": return <Hash className="h-3 w-3 text-orange-500" />;
    case "boolean": return <span className="text-[9px] font-bold text-yellow-600">T/F</span>;
    case "null": return <span className="text-[9px] font-medium text-[#04261A]/30">null</span>;
  }
}

function formatPreview(value: unknown, maxLen = 60): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value.length > maxLen ? value.slice(0, maxLen) + "..." : value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === "object") {
    const keys = Object.keys(value);
    return `{${keys.length} keys}`;
  }
  return String(value);
}

/* ---- Recursive tree node ---- */

function TreeNode({
  keyName,
  value,
  path,
  depth,
  onAddColumn,
}: {
  keyName: string;
  value: unknown;
  path: string;
  depth: number;
  onAddColumn: (path: string, name: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const type = getType(value);
  const isExpandable = type === "object" || type === "array";
  const children = isExpandable
    ? type === "array"
      ? (value as unknown[]).map((v, i) => ({ key: String(i), value: v }))
      : Object.entries(value as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }))
    : [];

  return (
    <div>
      <div
        className="group/node flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-[#04261A]/[0.03]"
        style={{ paddingLeft: depth * 16 + 4 }}
      >
        {/* Expand toggle */}
        {isExpandable ? (
          <button
            onClick={() => setExpanded((p) => !p)}
            className="shrink-0 rounded p-0.5 text-[#04261A]/40 hover:bg-[#04261A]/10 hover:text-[#04261A]/70"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Type icon */}
        <span className="shrink-0">{getTypeIcon(type)}</span>

        {/* Key name */}
        <span className="shrink-0 text-xs font-medium text-[#04261A]">{keyName}</span>

        {/* Preview value for leaves */}
        {!isExpandable && (
          <span className="ml-1 truncate text-xs text-[#04261A]/50">
            {type === "string" ? `"${formatPreview(value)}"` : formatPreview(value)}
          </span>
        )}

        {/* Item count for expandables */}
        {isExpandable && (
          <span className="ml-1 text-[10px] text-[#04261A]/30">
            {type === "array" ? `${children.length} items` : `${children.length} keys`}
          </span>
        )}

        {/* Add as column button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddColumn(path, keyName);
          }}
          className="ml-auto shrink-0 rounded-md border border-[#04261A]/10 px-1.5 py-0.5 text-[9px] font-medium text-[#04261A]/40 opacity-0 transition group-hover/node:opacity-100 hover:border-[#00DF82]/50 hover:bg-[#00DF82]/10 hover:text-[#04261A]"
          title={`Ajouter "${path}" comme colonne`}
        >
          <Plus className="inline h-2.5 w-2.5" /> colonne
        </button>
      </div>

      {/* Children */}
      {isExpandable && expanded && (
        <div>
          {children.map((child) => (
            <TreeNode
              key={child.key}
              keyName={child.key}
              value={child.value}
              path={path ? `${path}.${child.key}` : child.key}
              depth={depth + 1}
              onAddColumn={onAddColumn}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Main modal ---- */

export default function JSONTreeExplorer({ data, sourceColumnId, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const dispatch = useSheetDispatch();
  const { toast } = useToast();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handleAddColumn = (path: string, name: string) => {
    dispatch({
      type: "EXTRACT_JSON_COLUMN",
      sourceColumnId,
      jsonPath: path,
      columnName: name,
    });
    toast(`Colonne "${name}" creee depuis ${path}`, "success");
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
      .then(() => toast("JSON copie", "success"))
      .catch(() => toast("Erreur presse-papiers", "error"));
  };

  const type = getType(data);
  const entries = type === "array"
    ? (data as unknown[]).map((v, i) => ({ key: String(i), value: v }))
    : type === "object"
      ? Object.entries(data as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }))
      : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={ref}
        className="flex w-full max-w-lg flex-col rounded-2xl border-2 border-[#04261A] bg-white shadow-[6px_6px_0px_#04261A]"
        style={{ maxHeight: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#04261A]/10 px-5 py-3">
          <div className="flex items-center gap-2">
            <Braces className="h-4 w-4 text-[#00DF82]" />
            <h3 className="text-sm font-semibold text-[#04261A]">Explorateur JSON</h3>
            <span className="rounded-full bg-[#04261A]/5 px-2 py-0.5 text-[10px] text-[#04261A]/50">
              {type === "array" ? `${entries.length} items` : `${entries.length} cles`}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleCopyAll}
              className="rounded-lg border border-[#04261A]/10 p-1.5 text-[#04261A]/40 transition hover:bg-[#04261A]/5 hover:text-[#04261A]/70"
              title="Copier le JSON"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-[#04261A]/40 transition hover:bg-[#04261A]/5 hover:text-[#04261A]/70"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Hint */}
        <div className="border-b border-[#04261A]/5 bg-[#00DF82]/5 px-5 py-2">
          <p className="text-[10px] text-[#04261A]/50">
            Survole un champ et clique <span className="font-semibold">+ colonne</span> pour extraire sa valeur dans une nouvelle colonne pour toutes les lignes.
          </p>
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-auto px-3 py-2">
          {entries.length > 0 ? (
            entries.map((entry) => (
              <TreeNode
                key={entry.key}
                keyName={entry.key}
                value={entry.value}
                path={entry.key}
                depth={0}
                onAddColumn={handleAddColumn}
              />
            ))
          ) : (
            <div className="py-4 text-center text-xs text-[#04261A]/40">
              {type === "string" ? (
                <p className="break-all px-4">{String(data)}</p>
              ) : (
                <p>{formatPreview(data)}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
