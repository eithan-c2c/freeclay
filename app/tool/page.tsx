"use client";

import { useState } from "react";
import { SheetProvider } from "@/lib/sheetStore";
import { SelectionProvider } from "@/lib/selectionStore";
import { ToastProvider } from "./components/Toast";
import TopBar from "./components/TopBar";
import DataTable from "./components/DataTable";
import AddColumnModal from "./components/AddColumnModal";
import AddHttpColumnModal from "./components/AddHttpColumnModal";
import KeyboardShortcutsModal from "./components/KeyboardShortcutsModal";
import type { SheetColumn } from "@/lib/types";

export default function ToolPage() {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [showAddHttpColumn, setShowAddHttpColumn] = useState(false);
  const [editHttpColumn, setEditHttpColumn] = useState<SheetColumn | null>(null);
  const [editEnrichColumn, setEditEnrichColumn] = useState<SheetColumn | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <SheetProvider>
    <SelectionProvider>
    <ToastProvider>
      <div className="flex h-screen flex-col bg-[#F4F9F9] text-[#04261A]">
        {/* Header */}
        <header className="shrink-0 border-b border-[#04261A]/10 bg-white/80 backdrop-blur-xl">
          <div className="flex items-center justify-between px-4 py-2.5">
            <div className="flex items-center gap-2">
              <img src="/icon.svg" alt="FreeGTM" className="h-6 w-6 rounded-lg" />
              <span className="text-sm font-bold gradient-text">FreeGTM</span>
              <span className="hidden text-[10px] text-[#04261A]/35 sm:inline ml-2">Enrichissement de données open-source &middot; 100% gratuit</span>
            </div>

          </div>
        </header>

        {/* Toolbar */}
        <div className="shrink-0 px-3 py-2">
          <TopBar />
        </div>

        {/* Sheet */}
        <div className="flex flex-1 flex-col overflow-hidden px-3 pb-2">
          <DataTable
            onAddAIColumn={() => setShowAddColumn(true)}
            onAddHttpColumn={() => setShowAddHttpColumn(true)}
            onEditHttpColumn={(col) => setEditHttpColumn(col)}
            onEditEnrichColumn={(col) => setEditEnrichColumn(col)}
          />
        </div>

        {/* CTA Banner */}
        <div className="shrink-0 border-t-2 border-[#00DF82]/30 bg-gradient-to-r from-[#00DF82]/10 via-[#C8F05B]/10 to-[#00DF82]/10 px-4 py-3">
          <div className="flex items-center justify-center gap-3">
            <span className="text-xs text-[#04261A]/70">
              Besoin d&apos;aide avec votre stratégie <span className="font-semibold text-[#04261A]">Go-to-Market</span> ?
            </span>
            <a
              href="https://cold-to-cash.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#04261A] px-3 py-1.5 text-[11px] font-semibold text-[#00DF82] shadow-[2px_2px_0px_#00DF82] transition hover:shadow-[1px_1px_0px_#00DF82] hover:translate-x-[1px] hover:translate-y-[1px]"
            >
              Discutons &rarr;
            </a>
          </div>
        </div>

        {/* Footer with shortcuts button */}
        <div className="shrink-0 border-t border-[#04261A]/5 bg-white/50 px-4 py-1 flex items-center justify-center">
          <span className="text-[10px] text-[#04261A]/30">
            Créé par{" "}
            <a
              href="https://www.linkedin.com/in/eithan-benero/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[#04261A]/40 underline decoration-[#00DF82]/30 underline-offset-2 hover:text-[#04261A] hover:decoration-[#00DF82]"
            >
              Eithan Benero
            </a>
            {" "}&middot; Aucune donnée stockée
          </span>
          <button
            onClick={() => setShowShortcuts(true)}
            className="ml-auto rounded border border-[#04261A]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#04261A]/30 transition hover:bg-[#04261A]/5 hover:text-[#04261A]/50"
            title="Raccourcis clavier"
          >
            ?
          </button>
        </div>

        {/* Modals */}
        <AddColumnModal open={showAddColumn || !!editEnrichColumn} onClose={() => { setShowAddColumn(false); setEditEnrichColumn(null); }} editColumn={editEnrichColumn} />
        <AddHttpColumnModal open={showAddHttpColumn || !!editHttpColumn} onClose={() => { setShowAddHttpColumn(false); setEditHttpColumn(null); }} editColumn={editHttpColumn} />
        {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      </div>
    </ToastProvider>
    </SelectionProvider>
    </SheetProvider>
  );
}
