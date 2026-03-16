import type { SheetState, SheetAction } from "./types";

const SKIP_ACTIONS = new Set(["SET_API_KEY", "SET_KEY_VALID", "SET_CELL_STATUS", "SET_CELL_VALUE"]);
const MAX_HISTORY = 50;

export interface UndoableState {
  past: SheetState[];
  present: SheetState;
  future: SheetState[];
}

export function createUndoableReducer(baseReducer: (state: SheetState, action: SheetAction) => SheetState) {
  return function undoableReducer(state: UndoableState, action: SheetAction): UndoableState {
    if (action.type === "UNDO") {
      if (state.past.length === 0) return state;
      const prev = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: prev,
        future: [state.present, ...state.future],
      };
    }

    if (action.type === "REDO") {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }

    const newPresent = baseReducer(state.present, action);
    if (newPresent === state.present) return state;

    // Skip recording transient actions (status updates during enrichment)
    if (SKIP_ACTIONS.has(action.type)) {
      return { ...state, present: newPresent };
    }

    return {
      past: [...state.past.slice(-MAX_HISTORY + 1), state.present],
      present: newPresent,
      future: [],
    };
  };
}
