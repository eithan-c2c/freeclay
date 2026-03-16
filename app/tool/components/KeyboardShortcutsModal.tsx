"use client";

import { X } from "lucide-react";

const IS_MAC = typeof navigator !== "undefined" && navigator.platform.startsWith("Mac");
const MOD = IS_MAC ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { section: "Navigation" },
  { keys: ["↑", "↓", "←", "→"], label: "Se déplacer entre les cellules" },
  { keys: ["Tab"], label: "Cellule suivante" },
  { keys: ["Shift", "Tab"], label: "Cellule précédente" },
  { keys: ["Enter"], label: "Ligne suivante" },
  { keys: ["Esc"], label: "Désélectionner" },
  { section: "Sélection" },
  { keys: ["Shift", "Clic"], label: "Étendre la sélection" },
  { keys: ["Shift", "↑↓←→"], label: "Sélection par plage" },
  { section: "Édition" },
  { keys: [MOD, "C"], label: "Copier la sélection" },
  { keys: [MOD, "V"], label: "Coller" },
  { keys: [MOD, "Z"], label: "Annuler" },
  { keys: [MOD, "Shift", "Z"], label: "Rétablir" },
  { keys: ["Double-clic"], label: "Modifier une cellule ou un header" },
  { section: "Colonnes" },
  { keys: ["Clic droit"], label: "Menu contextuel colonne" },
  { keys: ["⋯"], label: "Menu colonne (bouton dans le header)" },
] as const;

export default function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border-2 border-[#04261A] bg-white p-6 shadow-[6px_6px_0px_#04261A]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#04261A]">Raccourcis clavier</h3>
          <button onClick={onClose} className="rounded p-1 text-[#04261A]/40 hover:bg-[#04261A]/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-1">
          {SHORTCUTS.map((item, i) => {
            if ("section" in item) {
              return (
                <div key={i} className="pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[#04261A]/40 first:pt-0">
                  {item.section}
                </div>
              );
            }
            return (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-xs text-[#04261A]/70">{item.label}</span>
                <div className="flex items-center gap-1">
                  {item.keys.map((key, j) => (
                    <span key={j}>
                      <kbd className="rounded border border-[#04261A]/15 bg-[#F4F9F9] px-1.5 py-0.5 text-[10px] font-medium text-[#04261A]/60">
                        {key}
                      </kbd>
                      {j < item.keys.length - 1 && <span className="mx-0.5 text-[10px] text-[#04261A]/30">+</span>}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
