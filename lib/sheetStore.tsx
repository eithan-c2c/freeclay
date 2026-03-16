"use client";

import { createContext, useContext, useReducer, useMemo, type Dispatch, type ReactNode } from "react";
import type { SheetState, SheetAction, SheetRow, SheetColumn } from "./types";
import { createUndoableReducer, type UndoableState } from "./undoableReducer";

let _id = 0;
const uid = () => `r${++_id}_${Date.now().toString(36)}`;

const EXAMPLE_COLUMNS: SheetColumn[] = [
  { id: "nom", name: "Nom", type: "data" },
  { id: "titre", name: "Titre", type: "data" },
  { id: "entreprise", name: "Entreprise", type: "data" },
  { id: "linkedin", name: "LinkedIn", type: "data" },
];

const EXAMPLE_ROWS: Record<string, string>[] = [
  { nom: "Varun Anand", titre: "Co-founder", entreprise: "Clay", linkedin: "linkedin.com/in/vaanand" },
  { nom: "Guillaume Moubeche", titre: "Founder & CEO", entreprise: "Lemlist", linkedin: "linkedin.com/in/guillaume-moubeche-a026541b2" },
  { nom: "Karri Saarinen", titre: "Co-founder & CEO", entreprise: "Linear", linkedin: "linkedin.com/in/karrisaarinen" },
  { nom: "Ivan Zhao", titre: "Co-founder & CEO", entreprise: "Notion", linkedin: "linkedin.com/in/ivanhzhao" },
  { nom: "Arthur Mensch", titre: "Co-founder & CEO", entreprise: "Mistral AI", linkedin: "linkedin.com/in/arthur-mensch" },
  { nom: "Guillermo Rauch", titre: "Founder & CEO", entreprise: "Vercel", linkedin: "linkedin.com/in/rauchg" },
];

const initialState: SheetState = {
  columns: [],
  rows: [],
  apiKeys: { anthropic: "", gemini: "" },
  keyValid: { anthropic: false, gemini: false },
};

function makeRow(columns: SheetColumn[], data: Record<string, string> = {}): SheetRow {
  return {
    id: uid(),
    data,
    cellStatus: {},
    cellErrors: {},
    cellRawJson: {},
  };
}

function uniqueName(baseName: string, existingNames: Set<string>): string {
  if (!existingNames.has(baseName)) return baseName;
  let i = 2;
  while (existingNames.has(`${baseName} (${i})`)) i++;
  return `${baseName} (${i})`;
}

function sheetReducer(state: SheetState, action: SheetAction): SheetState {
  switch (action.type) {
    case "IMPORT_CSV": {
      const cols: SheetColumn[] = action.columns.map((name) => ({
        id: name,
        name,
        type: "data" as const,
      }));
      const rows = action.rows.map((r) => makeRow(cols, r));
      return { ...state, columns: [...cols, ...state.columns.filter((c) => c.type !== "data")], rows };
    }

    case "ADD_ROW": {
      const empty: Record<string, string> = {};
      for (const col of state.columns) {
        if (col.type === "data") empty[col.id] = "";
      }
      return { ...state, rows: [...state.rows, makeRow(state.columns, empty)] };
    }

    case "ADD_ROWS_BULK": {
      // Auto-add any new data columns from the incoming rows
      const existingIds = new Set(state.columns.map((c) => c.id));
      const newCols: SheetColumn[] = [];
      for (const row of action.rows) {
        for (const key of Object.keys(row)) {
          if (!existingIds.has(key)) {
            existingIds.add(key);
            newCols.push({ id: key, name: key, type: "data" });
          }
        }
      }
      const newRows = action.rows.map((r) => makeRow(state.columns, r));
      return {
        ...state,
        columns: [...state.columns.filter((c) => c.type === "data"), ...newCols, ...state.columns.filter((c) => c.type !== "data")],
        rows: [...state.rows, ...newRows],
      };
    }

    case "UPDATE_CELL": {
      return {
        ...state,
        rows: state.rows.map((row) =>
          row.id === action.rowId
            ? { ...row, data: { ...row.data, [action.columnId]: action.value } }
            : row
        ),
      };
    }

    case "DELETE_ROWS": {
      const ids = new Set(action.rowIds);
      const remaining = state.rows.filter((r) => !ids.has(r.id));
      if (remaining.length === 0) return { ...initialState, apiKeys: state.apiKeys, keyValid: state.keyValid };
      return { ...state, rows: remaining };
    }

    case "ADD_ENRICHMENT_COLUMN":
    case "ADD_HTTP_COLUMN": {
      const existingNames = new Set(state.columns.map((c) => c.name));
      const col = { ...action.column, name: uniqueName(action.column.name, existingNames) };
      return {
        ...state,
        columns: [...state.columns, col],
        rows: state.rows.map((row) => ({
          ...row,
          cellStatus: { ...row.cellStatus, [col.id]: "idle" },
        })),
      };
    }

    case "REMOVE_COLUMN": {
      const remaining = state.columns.filter((c) => c.id !== action.columnId);
      if (remaining.length === 0) return { ...initialState, apiKeys: state.apiKeys, keyValid: state.keyValid };
      return {
        ...state,
        columns: remaining,
        rows: state.rows.map((row) => {
          const { [action.columnId]: _v, ...data } = row.data;
          const { [action.columnId]: _s, ...cellStatus } = row.cellStatus;
          const { [action.columnId]: _e, ...cellErrors } = row.cellErrors;
          const { [action.columnId]: _r, ...cellRawJson } = row.cellRawJson;
          return { ...row, data, cellStatus, cellErrors, cellRawJson };
        }),
      };
    }

    case "SET_CELL_STATUS": {
      return {
        ...state,
        rows: state.rows.map((row) =>
          row.id === action.rowId
            ? {
                ...row,
                cellStatus: { ...row.cellStatus, [action.columnId]: action.status },
                cellErrors: action.error
                  ? { ...row.cellErrors, [action.columnId]: action.error }
                  : row.cellErrors,
              }
            : row
        ),
      };
    }

    case "SET_CELL_VALUE": {
      return {
        ...state,
        rows: state.rows.map((row) => {
          if (row.id !== action.rowId) return row;
          const { [action.columnId]: _e, ...cellErrors } = row.cellErrors;
          return {
            ...row,
            data: { ...row.data, [action.columnId]: action.value },
            cellStatus: { ...row.cellStatus, [action.columnId]: "done" },
            cellErrors,
            cellRawJson: action.rawJson !== undefined
              ? { ...row.cellRawJson, [action.columnId]: action.rawJson }
              : row.cellRawJson,
          };
        }),
      };
    }

    case "SET_API_KEY": {
      return { ...state, apiKeys: { ...state.apiKeys, [action.provider]: action.key } };
    }

    case "SET_KEY_VALID": {
      return { ...state, keyValid: { ...state.keyValid, [action.provider]: action.valid } };
    }

    case "RENAME_COLUMN": {
      return {
        ...state,
        columns: state.columns.map((c) =>
          c.id === action.columnId ? { ...c, name: action.newName } : c
        ),
      };
    }

    case "RESIZE_COLUMN": {
      return {
        ...state,
        columns: state.columns.map((c) =>
          c.id === action.columnId ? { ...c, width: action.width } : c
        ),
      };
    }

    case "REORDER_COLUMNS": {
      const cols = [...state.columns];
      const [moved] = cols.splice(action.fromIndex, 1);
      cols.splice(action.toIndex, 0, moved);
      return { ...state, columns: cols };
    }

    case "DUPLICATE_COLUMN": {
      const src = state.columns.find((c) => c.id === action.columnId);
      if (!src) return state;
      const newId = `${src.id}_copy_${Date.now().toString(36)}`;
      const newCol: SheetColumn = { ...src, id: newId, name: `${src.name} (copie)` };
      const idx = state.columns.indexOf(src);
      const cols = [...state.columns];
      cols.splice(idx + 1, 0, newCol);
      return {
        ...state,
        columns: cols,
        rows: state.rows.map((row) => ({
          ...row,
          data: { ...row.data, [newId]: row.data[src.id] || "" },
          cellStatus: { ...row.cellStatus, [newId]: row.cellStatus[src.id] || "idle" },
          cellErrors: { ...row.cellErrors, ...(row.cellErrors[src.id] ? { [newId]: row.cellErrors[src.id] } : {}) },
        })),
      };
    }

    case "UPDATE_COLUMN_CONFIG": {
      return {
        ...state,
        columns: state.columns.map((c) =>
          c.id === action.columnId ? { ...c, ...action.updates } : c
        ),
        // Reset cell statuses + old results so the column re-runs with new config
        rows: state.rows.map((row) => {
          const { [action.columnId]: _e, ...cellErrors } = row.cellErrors;
          return {
            ...row,
            data: { ...row.data, [action.columnId]: "" },
            cellStatus: { ...row.cellStatus, [action.columnId]: "idle" },
            cellErrors,
          };
        }),
      };
    }

    case "EXTRACT_JSON_COLUMN": {
      const existingNames = new Set(state.columns.map((c) => c.name));
      const colName = uniqueName(action.columnName, existingNames);
      const colId = `json_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const newCol: SheetColumn = { id: colId, name: colName, type: "data" };
      const pathParts = action.jsonPath.split(".");
      return {
        ...state,
        columns: [...state.columns, newCol],
        rows: state.rows.map((row) => {
          const raw = row.cellRawJson[action.sourceColumnId];
          let extracted = "";
          if (raw != null && typeof raw === "object") {
            let current: unknown = raw;
            for (const part of pathParts) {
              if (current == null || typeof current !== "object") { current = undefined; break; }
              current = (current as Record<string, unknown>)[part];
            }
            if (current != null) {
              extracted = typeof current === "string" ? current : JSON.stringify(current);
            }
          }
          return {
            ...row,
            data: { ...row.data, [colId]: extracted },
            cellStatus: { ...row.cellStatus, [colId]: "idle" as const },
          };
        }),
      };
    }

    case "CLEAR_ALL": {
      return initialState;
    }

    // UNDO/REDO handled by wrapper
    case "UNDO":
    case "REDO":

    default:
      return state;
  }
}

const undoableReducer = createUndoableReducer(sheetReducer);
const undoableInitial: UndoableState = { past: [], present: initialState, future: [] };

const SheetContext = createContext<SheetState>(initialState);
const SheetDispatchContext = createContext<Dispatch<SheetAction>>(() => {});
const UndoContext = createContext<{ canUndo: boolean; canRedo: boolean }>({ canUndo: false, canRedo: false });

export function SheetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(undoableReducer, undoableInitial);
  const undoInfo = useMemo(() => ({ canUndo: state.past.length > 0, canRedo: state.future.length > 0 }), [state.past.length, state.future.length]);
  return (
    <SheetContext.Provider value={state.present}>
      <SheetDispatchContext.Provider value={dispatch}>
        <UndoContext.Provider value={undoInfo}>
          {children}
        </UndoContext.Provider>
      </SheetDispatchContext.Provider>
    </SheetContext.Provider>
  );
}

export function useSheet() {
  return useContext(SheetContext);
}

export function useSheetDispatch() {
  return useContext(SheetDispatchContext);
}

export function useUndoInfo() {
  return useContext(UndoContext);
}
