"use client";

import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { SelectionState } from "./types";

type SelectionAction =
  | { type: "SET_ACTIVE_CELL"; rowIndex: number; colIndex: number }
  | { type: "EXTEND_SELECTION"; rowIndex: number; colIndex: number }
  | { type: "CLEAR_SELECTION" }
  | { type: "SET_EDITING"; editing: boolean };

const initialSelection: SelectionState = {
  activeCell: null,
  rangeEnd: null,
  editing: false,
};

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "SET_ACTIVE_CELL":
      return { activeCell: { rowIndex: action.rowIndex, colIndex: action.colIndex }, rangeEnd: null, editing: false };
    case "EXTEND_SELECTION":
      return { ...state, rangeEnd: { rowIndex: action.rowIndex, colIndex: action.colIndex } };
    case "CLEAR_SELECTION":
      return initialSelection;
    case "SET_EDITING":
      return { ...state, editing: action.editing };
    default:
      return state;
  }
}

export function getSelectedRange(state: SelectionState) {
  if (!state.activeCell) return null;
  const end = state.rangeEnd || state.activeCell;
  return {
    startRow: Math.min(state.activeCell.rowIndex, end.rowIndex),
    endRow: Math.max(state.activeCell.rowIndex, end.rowIndex),
    startCol: Math.min(state.activeCell.colIndex, end.colIndex),
    endCol: Math.max(state.activeCell.colIndex, end.colIndex),
  };
}

const SelectionContext = createContext<SelectionState>(initialSelection);
const SelectionDispatchContext = createContext<Dispatch<SelectionAction>>(() => {});

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(selectionReducer, initialSelection);
  return (
    <SelectionContext.Provider value={state}>
      <SelectionDispatchContext.Provider value={dispatch}>
        {children}
      </SelectionDispatchContext.Provider>
    </SelectionContext.Provider>
  );
}

export function useSelection() {
  return useContext(SelectionContext);
}

export function useSelectionDispatch() {
  return useContext(SelectionDispatchContext);
}
