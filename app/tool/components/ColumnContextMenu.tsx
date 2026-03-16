"use client";

import { useEffect, useRef } from "react";
import type { SheetColumn } from "@/lib/types";
import { Pencil, ArrowUpAZ, ArrowDownAZ, Copy, Trash2, Play, X, Settings2 } from "lucide-react";

interface Props {
  column: SheetColumn;
  position: { x: number; y: number };
  isRunning: boolean;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onDuplicate: () => void;
  onRun?: () => void;
  onStop?: () => void;
  onEdit?: () => void;
}

export default function ColumnContextMenu({
  column, position, isRunning, onClose, onRename, onDelete, onSortAsc, onSortDesc, onDuplicate, onRun, onStop, onEdit,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handle);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handle); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  const isActionable = column.type === "enrichment" || column.type === "http";

  // Clamp to viewport
  const left = Math.min(position.x, typeof window !== "undefined" ? window.innerWidth - 200 : position.x);
  const top = Math.min(position.y, typeof window !== "undefined" ? window.innerHeight - 300 : position.y);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 rounded-xl border-2 border-[#04261A] bg-white py-1 shadow-[4px_4px_0px_#04261A]"
      style={{ left, top }}
    >
      {/* Run/Stop for enrichment/http */}
      {isActionable && (
        <>
          {isRunning ? (
            <MenuItem icon={X} label="Arrêter" onClick={() => { onStop?.(); onClose(); }} className="text-red-500" />
          ) : (
            <MenuItem icon={Play} label="Lancer" onClick={() => { onRun?.(); onClose(); }} />
          )}
          <Separator />
        </>
      )}

      {/* Edit config for http/enrichment */}
      {(column.type === "http" || column.type === "enrichment") && onEdit && (
        <MenuItem icon={Settings2} label="Modifier la config" onClick={() => { onEdit(); onClose(); }} />
      )}

      <MenuItem icon={Pencil} label="Renommer" onClick={() => { onRename(); onClose(); }} />

      {column.type === "data" && (
        <>
          <MenuItem icon={ArrowUpAZ} label="Trier A → Z" onClick={() => { onSortAsc(); onClose(); }} />
          <MenuItem icon={ArrowDownAZ} label="Trier Z → A" onClick={() => { onSortDesc(); onClose(); }} />
        </>
      )}

      <Separator />
      <MenuItem icon={Copy} label="Dupliquer" onClick={() => { onDuplicate(); onClose(); }} />
      <Separator />
      <MenuItem icon={Trash2} label="Supprimer" onClick={() => { onDelete(); onClose(); }} className="text-red-500" />
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, className = "" }: { icon: React.ComponentType<{ className?: string }>; label: string; onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs transition hover:bg-[#00DF82]/10 ${className || "text-[#04261A]"}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </button>
  );
}

function Separator() {
  return <div className="my-1 h-px bg-[#04261A]/10" />;
}
