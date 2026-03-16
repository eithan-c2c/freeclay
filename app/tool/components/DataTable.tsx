"use client";

import { useMemo, useState, useRef, useCallback, useId, useEffect, type DragEvent } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useSheet, useSheetDispatch } from "@/lib/sheetStore";
import { runColumnEnrichment } from "@/lib/enrichRunner";
import { runHttpColumn } from "@/lib/httpRunner";
import { parseFile } from "@/lib/fileParser";
import type { SheetRow, SheetColumn } from "@/lib/types";
import { Play, Loader2, AlertCircle, Trash2, X, Globe, Plus, Type, Link, Sparkles, Hash, ChevronUp, ChevronDown, Search, GripVertical, MoreHorizontal, Upload } from "lucide-react";
import { DndContext, closestCenter, type DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, horizontalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useSelection, useSelectionDispatch, getSelectedRange } from "@/lib/selectionStore";
import ColumnContextMenu from "./ColumnContextMenu";
import CellExpandPopover from "./CellExpandPopover";
import JSONTreeExplorer from "./JSONTreeExplorer";
import { useToast } from "./Toast";

/* ---- Module-level: pass initial character when starting edit by typing ---- */
let _pendingEditChar: string | null = null;

/* ------------------------------------------------------------------ */
/*  Editable Cell (display / edit toggle)                              */
/* ------------------------------------------------------------------ */

function EditableCell({ value, onChange, onExpand, rowIndex, colIndex }: {
  value: string; onChange: (v: string) => void; onExpand?: (e: React.MouseEvent) => void;
  rowIndex: number; colIndex: number;
}) {
  const selection = useSelection();
  const selDispatch = useSelectionDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const [draft, setDraft] = useState(value);

  const isEditing = selection.activeCell?.rowIndex === rowIndex
    && selection.activeCell?.colIndex === colIndex
    && selection.editing;

  // Sync draft when value changes externally (paste, undo, etc.)
  useEffect(() => { setDraft(value); }, [value]);

  // Focus input and handle pending char when entering edit mode
  useEffect(() => {
    if (isEditing) {
      cancelledRef.current = false;
      if (inputRef.current) {
        if (_pendingEditChar) {
          setDraft(_pendingEditChar);
          _pendingEditChar = null;
          inputRef.current.focus();
          setTimeout(() => inputRef.current?.setSelectionRange(1, 1), 0);
        } else {
          setDraft(value);
          inputRef.current.focus();
          inputRef.current.select();
        }
      }
    }
  }, [isEditing]);

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        data-cell-input=""
        className="h-full w-full border-none bg-white px-2 py-1.5 text-sm text-[#04261A] outline-none"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (!cancelledRef.current && draft !== value) onChange(draft);
          selDispatch({ type: "SET_EDITING", editing: false });
        }}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter") {
            if (draft !== value) onChange(draft);
            cancelledRef.current = true;
            selDispatch({ type: "SET_EDITING", editing: false });
          }
          if (e.key === "Escape") {
            cancelledRef.current = true;
            selDispatch({ type: "SET_EDITING", editing: false });
          }
          if (e.key === "Tab") {
            e.preventDefault();
            if (draft !== value) onChange(draft);
            cancelledRef.current = true;
            selDispatch({ type: "SET_EDITING", editing: false });
          }
        }}
      />
    );
  }

  return (
    <div
      className={`group/cell relative h-full w-full px-2 py-1.5 text-sm truncate cursor-default select-none ${value ? "text-[#04261A]" : "text-[#04261A]/25"}`}
      onDoubleClick={() => selDispatch({ type: "SET_EDITING", editing: true })}
    >
      {value || "—"}
      {value && value.length > 50 && (
        <button
          onClick={(e) => { e.stopPropagation(); onExpand?.(e); }}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-white/90 px-1 py-0.5 text-[9px] font-medium text-[#04261A]/40 opacity-0 ring-1 ring-[#04261A]/10 transition group-hover/cell:opacity-100 hover:text-[#04261A]/70"
        >
          voir
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Editable Header                                                    */
/* ------------------------------------------------------------------ */

function EditableHeader({ name, onRename }: { name: string; onRename: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!editing) {
    return (
      <span
        className="truncate text-xs font-medium text-[#04261A]/60 cursor-text"
        onDoubleClick={() => { setDraft(name); setEditing(true); setTimeout(() => inputRef.current?.select(), 0); }}
        title={`Double-clic pour renommer "${name}"`}
      >
        {name}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      className="w-full rounded border-none bg-white px-1 py-0 text-xs font-medium text-[#04261A] outline-none ring-2 ring-[#00DF82]"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim()) onRename(draft.trim()); setEditing(false); }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { if (draft.trim()) onRename(draft.trim()); setEditing(false); }
        if (e.key === "Escape") setEditing(false);
      }}
      autoFocus
    />
  );
}

/* ------------------------------------------------------------------ */
/*  Sortable Header (DnD)                                              */
/* ------------------------------------------------------------------ */

function SortableHeader({ id, children, canResize, resizeHandler, isResizing, onContextMenu }: {
  id: string; children: React.ReactNode; canResize: boolean;
  resizeHandler: ((e: unknown) => void) | undefined; isResizing: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <th
      ref={setNodeRef}
      style={style}
      className="group/th relative border-b-2 border-r border-[#04261A]/10 border-b-[#04261A]/15 px-2 py-2 text-left last:border-r-0"
      onContextMenu={onContextMenu}
    >
      <div className="flex items-center gap-1">
        <div {...attributes} {...listeners} className="shrink-0 cursor-grab opacity-0 group-hover/th:opacity-100 transition active:cursor-grabbing">
          <GripVertical className="h-3 w-3 text-[#04261A]/30" />
        </div>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
      {canResize && (
        <div
          onMouseDown={resizeHandler as React.MouseEventHandler | undefined}
          onTouchStart={resizeHandler as React.TouchEventHandler | undefined}
          className={`absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none ${
            isResizing ? "bg-[#00DF82]" : "bg-transparent hover:bg-[#00DF82]/50"
          }`}
        />
      )}
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Enrichment Cell                                                    */
/* ------------------------------------------------------------------ */

function EnrichmentCell({ row, column, onExpand, onExploreJson }: { row: SheetRow; column: SheetColumn; onExpand?: (e: React.MouseEvent) => void; onExploreJson?: () => void }) {
  const status = row.cellStatus[column.id] || "idle";
  const value = row.data[column.id] || "";
  const error = row.cellErrors[column.id];
  const hasRawJson = row.cellRawJson[column.id] != null && typeof row.cellRawJson[column.id] === "object";

  if (status === "running") {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#00DF82]" />
        <span className="text-xs text-[#04261A]/50">Enrichissement...</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="group/cell relative flex items-center gap-1.5 px-2 py-1.5" title={error || "Échoué"}>
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
        <span className="truncate text-xs text-red-500">{error || "Échoué"}</span>
        {error && error.length > 30 && (
          <button
            onClick={(e) => { e.stopPropagation(); onExpand?.(e); }}
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded bg-white/90 px-1 py-0.5 text-[9px] font-medium text-red-400 opacity-0 ring-1 ring-red-200 transition group-hover/cell:opacity-100 hover:text-red-600"
          >
            voir
          </button>
        )}
      </div>
    );
  }

  if (status === "done" && value) {
    return (
      <div className="group/cell relative truncate px-2 py-1.5 text-sm text-[#04261A] font-medium" title={value}>
        {value}
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 transition group-hover/cell:opacity-100">
          {hasRawJson && (
            <button
              onClick={(e) => { e.stopPropagation(); onExploreJson?.(); }}
              className="rounded bg-white/90 px-1 py-0.5 text-[9px] font-medium text-purple-500 ring-1 ring-purple-200 hover:bg-purple-50 hover:text-purple-700"
              title="Explorer le JSON"
            >
              {"{…}"}
            </button>
          )}
          {value.length > 50 && (
            <button
              onClick={(e) => { e.stopPropagation(); onExpand?.(e); }}
              className="rounded bg-white/90 px-1 py-0.5 text-[9px] font-medium text-[#04261A]/40 ring-1 ring-[#04261A]/10 hover:text-[#04261A]/70"
            >
              voir
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="px-2 py-1.5 text-xs text-[#04261A]/40">En file...</div>
    );
  }

  return <div className="px-2 py-1.5 text-xs text-[#04261A]/25">—</div>;
}

/* ------------------------------------------------------------------ */
/*  Column Types                                                       */
/* ------------------------------------------------------------------ */

const COLUMN_TYPES = [
  { id: "text", label: "Texte", icon: Type, description: "Colonne texte libre" },
  { id: "url", label: "URL", icon: Link, description: "Liens et adresses web" },
  { id: "number", label: "Nombre", icon: Hash, description: "Valeurs numériques" },
  { id: "ai", label: "Enrichissement IA", icon: Sparkles, description: "Claude ou Gemini" },
  { id: "http", label: "Requête HTTP", icon: Globe, description: "Appel API par ligne" },
] as const;

let _dataColId = 0;

/* ------------------------------------------------------------------ */
/*  Main DataTable Component                                           */
/* ------------------------------------------------------------------ */

export default function DataTable({ onAddAIColumn, onAddHttpColumn, onEditHttpColumn, onEditEnrichColumn }: { onAddAIColumn: () => void; onAddHttpColumn: () => void; onEditHttpColumn?: (col: SheetColumn) => void; onEditEnrichColumn?: (col: SheetColumn) => void }) {
  const dndId = useId();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const sheet = useSheet();
  const dispatch = useSheetDispatch();
  const { toast } = useToast();
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const stopRefs = useRef<Record<string, boolean>>({});
  const [runningCols, setRunningCols] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [addColStep, setAddColStep] = useState<"pick" | "name">("pick");
  const [pendingType, setPendingType] = useState<string>("");
  const addColRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ col: SheetColumn; x: number; y: number } | null>(null);
  const [expandPopover, setExpandPopover] = useState<{ value: string; x: number; y: number } | null>(null);
  const [jsonExplorer, setJsonExplorer] = useState<{ data: unknown; sourceColumnId: string } | null>(null);
  const selection = useSelection();
  const selDispatch = useSelectionDispatch();
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const navigableColIds = useMemo(() => sheet.columns.map((c) => c.id), [sheet.columns]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = sheet.columns.findIndex((c) => c.id === active.id);
    const toIndex = sheet.columns.findIndex((c) => c.id === over.id);
    if (fromIndex >= 0 && toIndex >= 0) dispatch({ type: "REORDER_COLUMNS", fromIndex, toIndex });
  }, [sheet.columns, dispatch]);

  /* ---- File drag & drop ---- */
  const handleFileDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["csv", "xlsx", "xls"].includes(ext || "")) {
      toast("Format non supporté. Utilise .csv, .xlsx ou .xls", "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast("Le fichier dépasse la limite de 10 Mo.", "error");
      return;
    }
    try {
      const parsed = await parseFile(file);
      if (parsed.totalRows === 0) { toast("Le fichier est vide.", "error"); return; }
      dispatch({ type: "IMPORT_CSV", columns: parsed.columns, rows: parsed.rows });
      toast(`${parsed.totalRows} lignes importées depuis ${file.name}`, "success");
    } catch (err) {
      toast((err as Error).message, "error");
    }
  }, [dispatch, toast]);

  const handleFileDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingFile(true);
  }, []);

  const handleFileDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only trigger leave if we're actually leaving the container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  }, []);

  const tableRef = useRef<ReturnType<typeof useReactTable<SheetRow>> | null>(null);

  /* ---- Global keyboard handler (document-level, no focus needed) ---- */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;

      // If user is editing a cell (input with data-cell-input), let it handle everything
      if (target?.hasAttribute?.("data-cell-input")) return;

      // Check if user is in a non-cell input (search bar, modal, etc.)
      const isExternalInput = tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable;

      const meta = e.metaKey || e.ctrlKey;
      const rows = tableRef.current?.getRowModel().rows ?? [];
      const numRows = rows.length;
      const numCols = navigableColIds.length;

      // Undo/Redo — works except in external inputs
      if (meta && e.key === "z" && !e.shiftKey && !isExternalInput) {
        e.preventDefault();
        dispatch({ type: "UNDO" });
        return;
      }
      if (meta && (e.key === "y" || (e.key === "z" && e.shiftKey)) && !isExternalInput) {
        e.preventDefault();
        dispatch({ type: "REDO" });
        return;
      }

      // Everything below requires a selected cell and NOT being in an external input
      if (!selection.activeCell || isExternalInput) return;

      // Copy
      if (meta && e.key === "c") {
        e.preventDefault();
        const range = getSelectedRange(selection);
        if (!range) return;
        const lines: string[] = [];
        for (let r = range.startRow; r <= range.endRow; r++) {
          const row = rows[r];
          if (!row) continue;
          const cells: string[] = [];
          for (let c = range.startCol; c <= range.endCol; c++) {
            cells.push(row.original.data[navigableColIds[c]] || "");
          }
          lines.push(cells.join("\t"));
        }
        const cellCount = (range.endRow - range.startRow + 1) * (range.endCol - range.startCol + 1);
        navigator.clipboard.writeText(lines.join("\n")).then(() => {
          toast(`${cellCount} cellule${cellCount > 1 ? "s" : ""} copiée${cellCount > 1 ? "s" : ""}`, "success");
        }).catch(() => {
          toast("Impossible d'accéder au presse-papiers", "error");
        });
        return;
      }

      // Paste
      if (meta && e.key === "v") {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          if (!text || !selection.activeCell) return;
          const pasteRows = text.split("\n").map((line) => line.split("\t"));
          const startRow = selection.activeCell.rowIndex;
          const startCol = selection.activeCell.colIndex;
          let pasted = 0;
          let skipped = 0;
          for (let r = 0; r < pasteRows.length; r++) {
            const rowIdx = startRow + r;
            if (rowIdx >= rows.length) { skipped += pasteRows[r].length; continue; }
            const row = rows[rowIdx];
            for (let c = 0; c < pasteRows[r].length; c++) {
              const colIdx = startCol + c;
              if (colIdx >= numCols) { skipped++; continue; }
              const colId = navigableColIds[colIdx];
              const col = sheet.columns.find((sc) => sc.id === colId);
              if (col?.type !== "data") { skipped++; continue; }
              dispatch({ type: "UPDATE_CELL", rowId: row.original.id, columnId: colId, value: pasteRows[r][c] });
              pasted++;
            }
          }
          if (pasted > 0) toast(`${pasted} cellule${pasted > 1 ? "s" : ""} collée${pasted > 1 ? "s" : ""}${skipped > 0 ? ` (${skipped} ignorée${skipped > 1 ? "s" : ""})` : ""}`, "success");
        }).catch(() => {
          toast("Impossible d'accéder au presse-papiers", "error");
        });
        return;
      }

      // Delete / Backspace — clear selected cells
      if ((e.key === "Delete" || e.key === "Backspace") && !selection.editing) {
        e.preventDefault();
        const range = getSelectedRange(selection);
        if (!range) return;
        let cleared = 0;
        for (let r = range.startRow; r <= range.endRow; r++) {
          const row = rows[r];
          if (!row) continue;
          for (let c = range.startCol; c <= range.endCol; c++) {
            const colId = navigableColIds[c];
            const col = sheet.columns.find((sc) => sc.id === colId);
            if (col?.type === "data" && row.original.data[colId]) {
              dispatch({ type: "UPDATE_CELL", rowId: row.original.id, columnId: colId, value: "" });
              cleared++;
            }
          }
        }
        if (cleared > 0) toast(`${cleared} cellule${cleared > 1 ? "s" : ""} effacée${cleared > 1 ? "s" : ""}`, "info");
        return;
      }

      // Enter starts editing on data columns
      if (e.key === "Enter" && !selection.editing) {
        e.preventDefault();
        const colId = navigableColIds[selection.activeCell.colIndex];
        const col = sheet.columns.find((sc) => sc.id === colId);
        if (col?.type === "data") {
          selDispatch({ type: "SET_EDITING", editing: true });
        }
        return;
      }

      // F2 starts editing on data columns
      if (e.key === "F2" && !selection.editing) {
        e.preventDefault();
        const colId = navigableColIds[selection.activeCell.colIndex];
        const col = sheet.columns.find((sc) => sc.id === colId);
        if (col?.type === "data") {
          selDispatch({ type: "SET_EDITING", editing: true });
        }
        return;
      }

      // Typing a printable character starts editing (replaces content, like a real spreadsheet)
      if (e.key.length === 1 && !meta && !e.altKey && !selection.editing) {
        const colId = navigableColIds[selection.activeCell.colIndex];
        const col = sheet.columns.find((sc) => sc.id === colId);
        if (col?.type === "data") {
          e.preventDefault();
          _pendingEditChar = e.key;
          selDispatch({ type: "SET_EDITING", editing: true });
          return;
        }
      }

      const { rowIndex, colIndex } = selection.activeCell;

      const move = (dr: number, dc: number, extend = false) => {
        const nr = Math.max(0, Math.min(numRows - 1, rowIndex + dr));
        const nc = Math.max(0, Math.min(numCols - 1, colIndex + dc));
        if (extend) selDispatch({ type: "EXTEND_SELECTION", rowIndex: nr, colIndex: nc });
        else selDispatch({ type: "SET_ACTIVE_CELL", rowIndex: nr, colIndex: nc });
      };

      if (e.key === "Tab") {
        e.preventDefault();
        move(0, e.shiftKey ? -1 : 1);
      } else if (e.key === "Enter" && !selection.editing) {
        e.preventDefault();
        move(e.shiftKey ? -1 : 1, 0);
      } else if (e.key === "Escape") {
        selDispatch({ type: "CLEAR_SELECTION" });
      } else if (!selection.editing) {
        if (e.key === "ArrowUp") { e.preventDefault(); move(-1, 0, e.shiftKey); }
        else if (e.key === "ArrowDown") { e.preventDefault(); move(1, 0, e.shiftKey); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); move(0, -1, e.shiftKey); }
        else if (e.key === "ArrowRight") { e.preventDefault(); move(0, 1, e.shiftKey); }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [selection, selDispatch, navigableColIds, dispatch, sheet.columns, toast]);

  /* ---- Enrichment runners ---- */

  const runEnrichment = useCallback(async (column: SheetColumn) => {
    if (!column.enrichmentConfig) return;
    const provider = column.enrichmentConfig.provider;
    const apiKey = sheet.apiKeys[provider];
    if (!apiKey || !sheet.keyValid[provider]) {
      toast(`Entre d'abord une clé API ${provider === "anthropic" ? "Anthropic" : "Google"} valide.`, "error");
      return;
    }

    const rowsToEnrich = sheet.rows.filter((r) => {
      const status = r.cellStatus[column.id];
      return !status || status === "idle" || status === "error";
    });

    if (rowsToEnrich.length === 0) return;

    for (const row of rowsToEnrich) {
      dispatch({ type: "SET_CELL_STATUS", rowId: row.id, columnId: column.id, status: "pending" });
    }

    stopRefs.current[column.id] = false;
    setRunningCols((prev) => new Set([...prev, column.id]));

    await runColumnEnrichment({
      apiKey,
      config: column.enrichmentConfig,
      columnId: column.id,
      columnName: column.name,
      rows: rowsToEnrich,
      concurrency: 3,
      onCellStart: (rowId) => dispatch({ type: "SET_CELL_STATUS", rowId, columnId: column.id, status: "running" }),
      onCellDone: (rowId, value) => dispatch({ type: "SET_CELL_VALUE", rowId, columnId: column.id, value }),
      onCellError: (rowId, error) => dispatch({ type: "SET_CELL_STATUS", rowId, columnId: column.id, status: "error", error }),
      shouldStop: () => stopRefs.current[column.id] ?? false,
    });

    setRunningCols((prev) => { const s = new Set(prev); s.delete(column.id); return s; });
  }, [sheet.rows, sheet.apiKeys, sheet.keyValid, dispatch, toast]);

  const runHttp = useCallback(async (column: SheetColumn) => {
    if (!column.httpConfig) return;

    const rowsToRun = sheet.rows.filter((r) => {
      const status = r.cellStatus[column.id];
      return !status || status === "idle" || status === "error";
    });

    if (rowsToRun.length === 0) return;

    for (const row of rowsToRun) {
      dispatch({ type: "SET_CELL_STATUS", rowId: row.id, columnId: column.id, status: "pending" });
    }

    // Build column name → id map so {{ColumnName}} resolves in URL templates
    const columnNameToId: Record<string, string> = {};
    for (const col of sheet.columns) {
      columnNameToId[col.name] = col.id;
    }

    stopRefs.current[column.id] = false;
    setRunningCols((prev) => new Set([...prev, column.id]));

    await runHttpColumn({
      config: column.httpConfig,
      columnId: column.id,
      columnNameToId,
      rows: rowsToRun,
      concurrency: 3,
      onCellStart: (rowId) => dispatch({ type: "SET_CELL_STATUS", rowId, columnId: column.id, status: "running" }),
      onCellDone: (rowId, value, rawJson) => dispatch({ type: "SET_CELL_VALUE", rowId, columnId: column.id, value, rawJson }),
      onCellError: (rowId, error) => dispatch({ type: "SET_CELL_STATUS", rowId, columnId: column.id, status: "error", error }),
      shouldStop: () => stopRefs.current[column.id] ?? false,
    });

    setRunningCols((prev) => { const s = new Set(prev); s.delete(column.id); return s; });
  }, [sheet.rows, sheet.columns, dispatch]);

  const stopEnrichment = useCallback((columnId: string) => {
    stopRefs.current[columnId] = true;
  }, []);

  /* ---- Column defs ---- */

  const columns = useMemo<ColumnDef<SheetRow>[]>(() => {
    const cols: ColumnDef<SheetRow>[] = [];

    // Checkbox column
    cols.push({
      id: "_select",
      size: 40,
      enableResizing: false,
      header: () => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-[#04261A]/20 bg-transparent accent-[#00DF82]"
            checked={selectedRows.size === sheet.rows.length && sheet.rows.length > 0}
            onChange={(e) => {
              if (e.target.checked) setSelectedRows(new Set(sheet.rows.map((r) => r.id)));
              else setSelectedRows(new Set());
            }}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            className="h-3.5 w-3.5 rounded border-[#04261A]/20 bg-transparent accent-[#00DF82]"
            checked={selectedRows.has(row.original.id)}
            onChange={(e) => {
              setSelectedRows((prev) => {
                const s = new Set(prev);
                e.target.checked ? s.add(row.original.id) : s.delete(row.original.id);
                return s;
              });
            }}
          />
        </div>
      ),
    });

    // Row number column — with hover delete button
    cols.push({
      id: "_rownum",
      size: 50,
      enableResizing: false,
      header: () => <span className="text-[10px] text-[#04261A]/30">#</span>,
      cell: ({ row }) => (
        <div className="group/row flex items-center justify-between">
          <span className="text-[10px] text-[#04261A]/30">{row.index + 1}</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "DELETE_ROWS", rowIds: [row.original.id] });
              toast("Ligne supprimée", "info");
            }}
            className="rounded p-0.5 text-[#04261A]/0 transition group-hover/row:text-[#04261A]/30 hover:!bg-red-50 hover:!text-red-500"
            title="Supprimer la ligne"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ),
    });

    // Data and enrichment columns
    for (let _ci = 0; _ci < sheet.columns.length; _ci++) {
      const col = sheet.columns[_ci];
      const colIdx = _ci; // capture for closures
      if (col.type === "data") {
        cols.push({
          id: col.id,
          size: col.width || 180,
          enableSorting: true,
          accessorFn: (row: SheetRow) => row.data[col.id] || "",
          header: ({ column: tCol }) => (
            <div className="flex items-center gap-1">
              <EditableHeader name={col.name} onRename={(v) => dispatch({ type: "RENAME_COLUMN", columnId: col.id, newName: v })} />
              <button
                onClick={tCol.getToggleSortingHandler()}
                className="shrink-0 rounded p-0.5 text-[#04261A]/25 hover:text-[#04261A]/60"
                title="Trier"
              >
                {tCol.getIsSorted() === "asc" ? <ChevronUp className="h-3 w-3" /> : tCol.getIsSorted() === "desc" ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3 opacity-0 group-hover/th:opacity-100" />}
              </button>
              {/* ⋯ menu button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setContextMenu({ col, x: rect.left, y: rect.bottom + 4 });
                }}
                className="shrink-0 rounded p-0.5 text-[#04261A]/0 transition group-hover/th:text-[#04261A]/30 hover:!text-[#04261A]/60 hover:!bg-[#04261A]/5"
                title="Options"
              >
                <MoreHorizontal className="h-3 w-3" />
              </button>
            </div>
          ),
          cell: ({ row }) => (
            <EditableCell
              value={row.original.data[col.id] || ""}
              onChange={(v) => dispatch({ type: "UPDATE_CELL", rowId: row.original.id, columnId: col.id, value: v })}
              rowIndex={row.index}
              colIndex={colIdx}
              onExpand={(e) => {
                const value = row.original.data[col.id] || "";
                if (value) setExpandPopover({ value, x: e.clientX, y: e.clientY });
              }}
            />
          ),
        });
      } else {
        const isRunning = runningCols.has(col.id);
        const isHttp = col.type === "http";
        const runFn = isHttp ? () => runHttp(col) : () => runEnrichment(col);
        cols.push({
          id: col.id,
          size: col.width || 200,
          header: () => (
            <div className="flex items-center gap-1.5">
              {isHttp && <Globe className="h-3 w-3 shrink-0 text-[#00DF82]/60" />}
              <EditableHeader name={col.name} onRename={(v) => dispatch({ type: "RENAME_COLUMN", columnId: col.id, newName: v })} />
              <div className="ml-auto flex items-center gap-0.5">
                {isRunning ? (
                  <button onClick={() => stopEnrichment(col.id)} className="rounded p-0.5 text-red-500 hover:bg-red-50 hover:text-red-600" title="Arrêter">
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button onClick={runFn} className="rounded p-0.5 text-[#04261A]/40 hover:bg-[#00DF82]/10 hover:text-[#00DF82]" title={isHttp ? "Lancer les requêtes" : "Lancer l'enrichissement"}>
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}
                {/* ⋯ menu button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setContextMenu({ col, x: rect.left, y: rect.bottom + 4 });
                  }}
                  className="rounded p-0.5 text-[#04261A]/25 hover:bg-[#04261A]/5 hover:text-[#04261A]/60"
                  title="Options"
                >
                  <MoreHorizontal className="h-3 w-3" />
                </button>
              </div>
            </div>
          ),
          cell: ({ row }) => (
            <EnrichmentCell
              row={row.original}
              column={col}
              onExpand={(e) => {
                const value = row.original.data[col.id] || row.original.cellErrors[col.id] || "";
                if (value) setExpandPopover({ value, x: e.clientX, y: e.clientY });
              }}
              onExploreJson={() => {
                const rawJson = row.original.cellRawJson[col.id];
                if (rawJson && typeof rawJson === "object") {
                  setJsonExplorer({ data: rawJson, sourceColumnId: col.id });
                }
              }}
            />
          ),
        });
      }
    }

    // Add column "+" button
    cols.push({
      id: "_add_col",
      size: 44,
      enableResizing: false,
      header: () => (
        <div className="relative flex justify-center" ref={addColRef}>
          <button
            onClick={() => { setShowAddCol((p) => !p); setAddColStep("pick"); setNewColName(""); }}
            className="rounded-md p-0.5 text-[#04261A]/30 transition hover:bg-[#00DF82]/15 hover:text-[#00DF82]"
            title="Ajouter une colonne"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      ),
      cell: () => null,
    });

    return cols;
  }, [sheet.columns, sheet.rows, selectedRows, runningCols, dispatch, runEnrichment, runHttp, stopEnrichment, toast]);

  const table = useReactTable({
    data: sheet.rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = (filterValue as string).toLowerCase();
      return Object.values(row.original.data).some((v) => v?.toLowerCase().includes(search));
    },
  });
  tableRef.current = table;

  const handlePickType = (typeId: string) => {
    if (typeId === "ai") {
      setShowAddCol(false);
      onAddAIColumn();
      return;
    }
    if (typeId === "http") {
      setShowAddCol(false);
      onAddHttpColumn();
      return;
    }
    setPendingType(typeId);
    setAddColStep("name");
    setNewColName("");
  };

  const handleCreateDataCol = () => {
    const name = newColName.trim();
    if (!name) return;
    const colId = `col_${++_dataColId}_${Date.now().toString(36)}`;
    const column: SheetColumn = { id: colId, name, type: "data" };
    dispatch({ type: "ADD_ENRICHMENT_COLUMN", column });
    setShowAddCol(false);
    setNewColName("");
    setAddColStep("pick");
  };

  /* ---- Empty state with drag & drop ---- */

  if (sheet.columns.length === 0) {
    return (
      <div
        className={`flex flex-1 items-center justify-center rounded-xl border-2 border-dashed bg-white p-12 transition-colors ${
          isDraggingFile ? "border-[#00DF82] bg-[#00DF82]/5" : "border-[#04261A]/10"
        }`}
        onDrop={handleFileDrop}
        onDragOver={handleFileDragOver}
        onDragLeave={handleFileDragLeave}
      >
        <div className="text-center">
          <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
            isDraggingFile ? "bg-[#00DF82]/30" : "bg-[#00DF82]/15"
          }`}>
            <Upload className={`h-6 w-6 transition-colors ${isDraggingFile ? "text-[#00DF82]" : "text-[#00DF82]/70"}`} />
          </div>
          <p className="text-sm font-medium text-[#04261A]/70">
            {isDraggingFile ? "Dépose ton fichier ici" : "Glisse un fichier CSV ici"}
          </p>
          <p className="mt-1 text-xs text-[#04261A]/40">ou utilise le bouton Importer dans la barre d&apos;outils</p>
          <p className="mt-0.5 text-[10px] text-[#04261A]/30">.csv, .xlsx, .xls — max 10 Mo</p>
        </div>
      </div>
    );
  }

  /* ---- Main table ---- */

  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden rounded-xl border bg-white transition-colors ${
        isDraggingFile ? "border-[#00DF82] border-2" : "border-[#04261A]/10"
      }`}
      onDrop={handleFileDrop}
      onDragOver={handleFileDragOver}
      onDragLeave={handleFileDragLeave}
    >
      {/* Drag overlay */}
      {isDraggingFile && (
        <div className="flex items-center justify-center gap-2 border-b border-[#00DF82]/30 bg-[#00DF82]/10 px-3 py-2">
          <Upload className="h-4 w-4 text-[#00DF82]" />
          <span className="text-xs font-medium text-[#04261A]/70">Dépose ton fichier pour importer</span>
        </div>
      )}

      {/* Filter bar */}
      {sheet.rows.length > 0 && (
        <div className="flex items-center gap-2 border-b border-[#04261A]/5 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 shrink-0 text-[#04261A]/30" />
          <input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filtrer les lignes..."
            className="flex-1 bg-transparent text-xs text-[#04261A] outline-none placeholder:text-[#04261A]/30"
          />
          {globalFilter && (
            <button onClick={() => setGlobalFilter("")} className="rounded p-0.5 text-[#04261A]/30 hover:text-[#04261A]/60">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto" ref={tableWrapperRef}>
        {mounted ? (
        <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[#F4F9F9]">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  <SortableContext items={sheet.columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
                    {hg.headers.map((header) => {
                      const isSortable = sheet.columns.some((c) => c.id === header.id);
                      if (isSortable) {
                        return (
                          <SortableHeader
                            key={header.id}
                            id={header.id}
                            canResize={header.column.getCanResize()}
                            resizeHandler={header.getResizeHandler()}
                            isResizing={header.column.getIsResizing()}
                            onContextMenu={(e) => {
                              const col = sheet.columns.find((c) => c.id === header.id);
                              if (col) { e.preventDefault(); setContextMenu({ col, x: e.clientX, y: e.clientY }); }
                            }}
                          >
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </SortableHeader>
                        );
                      }
                      return (
                        <th
                          key={header.id}
                          className="group/th relative border-b-2 border-r border-[#04261A]/10 border-b-[#04261A]/15 px-2 py-2 text-left last:border-r-0"
                          style={{ width: header.getSize(), minWidth: header.getSize() }}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      );
                    })}
                  </SortableContext>
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const range = getSelectedRange(selection);
                return (
                  <tr key={row.id} className="group/tablerow border-b border-[#04261A]/5 hover:bg-[#00DF82]/[0.03]">
                    {row.getVisibleCells().map((cell) => {
                      const colIdx = navigableColIds.indexOf(cell.column.id);
                      const isActive = selection.activeCell?.rowIndex === row.index && selection.activeCell?.colIndex === colIdx;
                      const isInRange = colIdx >= 0 && range && row.index >= range.startRow && row.index <= range.endRow && colIdx >= range.startCol && colIdx <= range.endCol;
                      return (
                        <td
                          key={cell.id}
                          className={`border-r border-[#04261A]/5 p-0 last:border-r-0 ${isActive ? "ring-2 ring-inset ring-[#00DF82]" : ""} ${isInRange && !isActive ? "bg-[#00DF82]/10" : ""}`}
                          style={{ width: cell.column.getSize(), minWidth: cell.column.getSize(), maxWidth: cell.column.getSize() }}
                          onClick={(e) => {
                            if (colIdx < 0) return;
                            if (e.shiftKey && selection.activeCell) {
                              selDispatch({ type: "EXTEND_SELECTION", rowIndex: row.index, colIndex: colIdx });
                            } else {
                              selDispatch({ type: "SET_ACTIVE_CELL", rowIndex: row.index, colIndex: colIdx });
                            }
                            // Focus the table wrapper so keyboard events work
                            tableWrapperRef.current?.focus();
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {/* Add row — right after last data row */}
              <tr className="border-b border-[#04261A]/5">
                <td colSpan={columns.length} className="p-0">
                  <button
                    onClick={() => dispatch({ type: "ADD_ROW" })}
                    className="flex w-full items-center gap-1 px-3 py-1.5 text-[10px] font-medium text-[#04261A]/40 transition hover:bg-[#00DF82]/[0.05] hover:text-[#00DF82]"
                  >
                    <Plus className="h-3 w-3" /> Ligne
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </DndContext>
        ) : (
          <table className="w-full border-collapse"><tbody><tr><td>Chargement...</td></tr></tbody></table>
        )}
      </div>

      {/* Add column dropdown */}
      {showAddCol && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowAddCol(false); setAddColStep("pick"); }}>
          <div
            className="absolute z-50 w-56 rounded-xl border-2 border-[#04261A] bg-white shadow-[4px_4px_0px_#04261A]"
            style={{
              top: addColRef.current ? addColRef.current.getBoundingClientRect().bottom + 4 : 0,
              left: addColRef.current ? Math.min(addColRef.current.getBoundingClientRect().left, window.innerWidth - 240) : 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {addColStep === "pick" ? (
              <div className="py-1.5">
                <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#04261A]/40">
                  Type de colonne
                </div>
                {COLUMN_TYPES.map((ct) => {
                  const Icon = ct.icon;
                  return (
                    <button
                      key={ct.id}
                      onClick={() => handlePickType(ct.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[#00DF82]/10"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[#04261A]/40" />
                      <div>
                        <div className="text-xs font-medium text-[#04261A]">{ct.label}</div>
                        <div className="text-[10px] text-[#04261A]/40">{ct.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-3">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-[#04261A]/40">
                  Nom de la colonne
                </label>
                <input
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateDataCol(); if (e.key === "Escape") { setShowAddCol(false); setAddColStep("pick"); } }}
                  placeholder={pendingType === "url" ? "ex: Site web" : pendingType === "number" ? "ex: Revenue" : "ex: Notes"}
                  className="mt-1.5 w-full rounded-lg border-2 border-[#04261A]/10 bg-[#F4F9F9] px-2.5 py-1.5 text-sm text-[#04261A] outline-none placeholder:text-[#04261A]/30 focus:border-[#00DF82]"
                  autoFocus
                />
                <div className="mt-2 flex gap-1.5">
                  <button
                    onClick={() => setAddColStep("pick")}
                    className="flex-1 rounded-lg border border-[#04261A]/15 py-1.5 text-[10px] font-medium text-[#04261A]/50 hover:bg-[#04261A]/5"
                  >
                    Retour
                  </button>
                  <button
                    onClick={handleCreateDataCol}
                    disabled={!newColName.trim()}
                    className="flex-1 rounded-lg bg-[#00DF82] py-1.5 text-[10px] font-semibold text-[#04261A] disabled:opacity-40"
                  >
                    Créer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <ColumnContextMenu
          column={contextMenu.col}
          position={{ x: contextMenu.x, y: contextMenu.y }}
          isRunning={runningCols.has(contextMenu.col.id)}
          onClose={() => setContextMenu(null)}
          onRename={() => {
            const newName = prompt("Nouveau nom :", contextMenu.col.name);
            if (newName?.trim()) dispatch({ type: "RENAME_COLUMN", columnId: contextMenu.col.id, newName: newName.trim() });
          }}
          onDelete={() => {
            dispatch({ type: "REMOVE_COLUMN", columnId: contextMenu.col.id });
            toast(`Colonne "${contextMenu.col.name}" supprimée`, "info");
          }}
          onSortAsc={() => setSorting([{ id: contextMenu.col.id, desc: false }])}
          onSortDesc={() => setSorting([{ id: contextMenu.col.id, desc: true }])}
          onDuplicate={() => {
            dispatch({ type: "DUPLICATE_COLUMN", columnId: contextMenu.col.id });
            toast(`Colonne "${contextMenu.col.name}" dupliquée`, "success");
          }}
          onRun={() => {
            const col = contextMenu.col;
            if (col.type === "http") runHttp(col);
            else if (col.type === "enrichment") runEnrichment(col);
          }}
          onStop={() => stopEnrichment(contextMenu.col.id)}
          onEdit={() => {
            const col = contextMenu.col;
            if (col.type === "http" && onEditHttpColumn) onEditHttpColumn(col);
            else if (col.type === "enrichment" && onEditEnrichColumn) onEditEnrichColumn(col);
          }}
        />
      )}

      {/* Cell expand popover */}
      {expandPopover && (
        <CellExpandPopover
          value={expandPopover.value}
          position={{ x: expandPopover.x, y: expandPopover.y }}
          onClose={() => setExpandPopover(null)}
        />
      )}

      {/* JSON tree explorer */}
      {jsonExplorer && (
        <JSONTreeExplorer
          data={jsonExplorer.data}
          sourceColumnId={jsonExplorer.sourceColumnId}
          onClose={() => setJsonExplorer(null)}
        />
      )}

      {/* Footer */}
      <div className="relative flex items-center justify-end border-t border-[#04261A]/10 bg-[#F4F9F9] px-3 py-1">
        <span className="text-[10px] text-[#04261A]/40">{sheet.rows.length} lignes · {sheet.columns.length} colonnes</span>

        {/* Floating bulk actions — overlays footer, no layout shift */}
        {selectedRows.size > 0 && (
          <div className="absolute inset-0 flex items-center gap-2 bg-white/95 px-3 backdrop-blur-sm">
            <span className="text-xs font-medium text-[#04261A]">{selectedRows.size} sélectionné{selectedRows.size > 1 ? "s" : ""}</span>
            <button
              onClick={() => {
                const count = selectedRows.size;
                dispatch({ type: "DELETE_ROWS", rowIds: Array.from(selectedRows) });
                setSelectedRows(new Set());
                toast(`${count} ligne${count > 1 ? "s" : ""} supprimée${count > 1 ? "s" : ""}`, "info");
              }}
              className="flex items-center gap-1 rounded-lg bg-red-500 px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-red-600"
            >
              <Trash2 className="h-3 w-3" /> Supprimer
            </button>
            <button
              onClick={() => setSelectedRows(new Set())}
              className="ml-auto rounded p-1 text-[#04261A]/40 hover:bg-[#04261A]/5 hover:text-[#04261A]"
              title="Désélectionner"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
