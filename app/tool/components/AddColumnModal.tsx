"use client";

import { useState, useEffect } from "react";
import { useSheet, useSheetDispatch } from "@/lib/sheetStore";
import type { Provider, ModelId, SheetColumn, EnrichmentColumnConfig } from "@/lib/types";
import { ANTHROPIC_MODELS, GEMINI_MODELS, MODEL_GUIDANCE } from "@/lib/pricing";
import { X, Sparkles, Globe } from "lucide-react";

const TEMPLATES = [
  { label: "Recherche entreprise", description: "Trouve le nom du CEO, le montant total levé, le nombre d'employés, et une brève description de l'entreprise" },
  { label: "Postes ouverts", description: "Trouve le nombre de postes ouverts, les rôles les plus recrutés, et l'URL de la page carrières" },
  { label: "Actus récentes", description: "Trouve le titre de l'actu la plus récente, la date, et un bref résumé" },
  { label: "Stack technique", description: "Trouve les langages principaux, le cloud provider, et les technologies clés utilisées" },
  { label: "URL LinkedIn", description: "Trouve l'URL de la page LinkedIn de l'entreprise" },
  { label: "Trouver email", description: "Trouve la meilleure adresse email professionnelle pour ce contact" },
];

let _colId = 0;

interface Props {
  open: boolean;
  onClose: () => void;
  editColumn?: SheetColumn | null;
}

export default function AddColumnModal({ open, onClose, editColumn }: Props) {
  const sheet = useSheet();
  const dispatch = useSheetDispatch();

  const dataColumns = sheet.columns.filter((c) => c.type === "data");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedInputs, setSelectedInputs] = useState<string[]>(() => dataColumns.map((c) => c.id));
  const [provider, setProvider] = useState<Provider>("gemini");
  const [modelId, setModelId] = useState<ModelId>("gemini-2.5-flash");
  const [useWebSearch, setUseWebSearch] = useState(true);

  const isEditing = !!editColumn;

  // Pre-fill when editing
  useEffect(() => {
    if (open && editColumn?.enrichmentConfig) {
      const cfg = editColumn.enrichmentConfig;
      setName(editColumn.name);
      setDescription(cfg.description);
      setSelectedInputs(cfg.inputColumns);
      setProvider(cfg.provider);
      setModelId(cfg.modelId);
      setUseWebSearch(cfg.useWebSearch ?? true);
    } else if (open && !editColumn) {
      setName("");
      setDescription("");
      setSelectedInputs(dataColumns.map((c) => c.id));
      setProvider("gemini");
      setModelId("gemini-2.5-flash");
      setUseWebSearch(true);
    }
  }, [open, editColumn]);

  if (!open) return null;

  const models = provider === "anthropic" ? Object.entries(ANTHROPIC_MODELS) : Object.entries(GEMINI_MODELS);

  const handleAdd = () => {
    if (!name.trim() || !description.trim() || selectedInputs.length === 0) return;

    const config: EnrichmentColumnConfig = {
      provider,
      modelId,
      inputColumns: selectedInputs,
      description: description.trim(),
      useWebSearch,
    };

    if (isEditing) {
      dispatch({ type: "UPDATE_COLUMN_CONFIG", columnId: editColumn.id, updates: { name: name.trim(), enrichmentConfig: config } });
    } else {
      const colId = `enrich_${++_colId}_${Date.now().toString(36)}`;
      const column: SheetColumn = {
        id: colId,
        name: name.trim(),
        type: "enrichment",
        enrichmentConfig: config,
      };
      dispatch({ type: "ADD_ENRICHMENT_COLUMN", column });
    }

    onClose();
    setName("");
    setDescription("");
    setSelectedInputs(dataColumns.map((c) => c.id));
  };

  const applyTemplate = (t: typeof TEMPLATES[0]) => {
    setDescription(t.description);
    if (!name.trim()) setName(t.label);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border-2 border-[#04261A] bg-white shadow-[6px_6px_0px_#04261A]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-[#04261A]/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[#00DF82]" />
            <h3 className="text-sm font-semibold text-[#04261A]">{isEditing ? "Modifier la colonne IA" : "Ajouter une colonne IA"}</h3>
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
              placeholder="ex: Taille entreprise, URL LinkedIn..."
              className="mt-1 w-full rounded-lg border-2 border-[#04261A]/10 bg-[#F4F9F9] px-3 py-2 text-sm text-[#04261A] outline-none placeholder:text-[#04261A]/30 focus:border-[#00DF82]"
              autoFocus
            />
          </div>

          {/* Templates — only in create mode */}
          {!isEditing && <div>
            <label className="text-xs font-medium text-[#04261A]/60">Templates rapides</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  onClick={() => applyTemplate(t)}
                  className="rounded-full border border-[#04261A]/10 px-2.5 py-1 text-[10px] text-[#04261A]/50 transition hover:border-[#00DF82]/50 hover:bg-[#00DF82]/5 hover:text-[#04261A]"
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>}

          {/* Description */}
          <div>
            <label className="text-xs font-medium text-[#04261A]/60">Quoi chercher</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décris quelles données extraire pour chaque ligne..."
              rows={3}
              className="mt-1 w-full rounded-lg border-2 border-[#04261A]/10 bg-[#F4F9F9] px-3 py-2 text-sm text-[#04261A] outline-none placeholder:text-[#04261A]/30 focus:border-[#00DF82]"
            />
          </div>

          {/* Input columns */}
          <div>
            <label className="text-xs font-medium text-[#04261A]/60">Colonnes d&apos;entrée (envoyées à l&apos;IA)</label>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {dataColumns.map((col) => (
                <button
                  key={col.id}
                  onClick={() =>
                    setSelectedInputs((p) =>
                      p.includes(col.id) ? p.filter((c) => c !== col.id) : [...p, col.id]
                    )
                  }
                  className={`rounded-lg border px-2.5 py-1 text-xs transition ${
                    selectedInputs.includes(col.id)
                      ? "border-[#00DF82] bg-[#00DF82]/15 text-[#04261A] font-medium"
                      : "border-[#04261A]/10 text-[#04261A]/50 hover:border-[#04261A]/20"
                  }`}
                >
                  {col.name}
                </button>
              ))}
            </div>
          </div>

          {/* Provider + Model */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#04261A]/60">Fournisseur</label>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={() => { setProvider("anthropic"); setModelId("claude-haiku-4-5-20251001"); }}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    provider === "anthropic" ? "border-[#00DF82] bg-[#00DF82]/15 text-[#04261A]" : "border-[#04261A]/10 text-[#04261A]/50 hover:border-[#04261A]/20"
                  }`}
                >
                  Claude
                </button>
                <button
                  onClick={() => { setProvider("gemini"); setModelId("gemini-2.5-flash"); }}
                  className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    provider === "gemini" ? "border-[#00DF82] bg-[#00DF82]/15 text-[#04261A]" : "border-[#04261A]/10 text-[#04261A]/50 hover:border-[#04261A]/20"
                  }`}
                >
                  Gemini
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#04261A]/60">Modèle</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value as ModelId)}
                className="mt-1.5 w-full rounded-lg border-2 border-[#04261A]/10 bg-[#F4F9F9] px-2 py-1.5 text-xs text-[#04261A] outline-none focus:border-[#00DF82]"
              >
                {models.map(([id, config]) => {
                  const guidance = MODEL_GUIDANCE[id as ModelId];
                  return (
                    <option key={id} value={id}>
                      {config.label} ({guidance?.speed || "?"})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Web search toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={useWebSearch}
              onChange={(e) => setUseWebSearch(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#04261A]/20 bg-transparent accent-[#00DF82]"
            />
            <Globe className="h-3.5 w-3.5 text-[#04261A]/40" />
            <span className="text-xs text-[#04261A]/60">Utiliser la recherche web pour données en temps réel</span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t border-[#04261A]/10 px-6 py-4">
          <button onClick={onClose} className="rounded-lg border border-[#04261A]/15 px-4 py-2 text-xs font-medium text-[#04261A]/50 transition hover:bg-[#04261A]/5">
            Annuler
          </button>
          <button
            onClick={handleAdd}
            disabled={!name.trim() || !description.trim() || selectedInputs.length === 0}
            className="rounded-lg bg-[#00DF82] px-4 py-2 text-xs font-semibold text-[#04261A] shadow-[3px_3px_0px_#04261A] transition hover:shadow-[1px_1px_0px_#04261A] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-40 disabled:shadow-none"
          >
            {isEditing ? "Sauvegarder" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}
