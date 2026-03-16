"use client";

import { useEffect, useRef } from "react";
import { X, Copy } from "lucide-react";
import { useToast } from "./Toast";

interface Props {
  value: string;
  position: { x: number; y: number };
  onClose: () => void;
}

export default function CellExpandPopover({ value, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  const left = Math.min(position.x, typeof window !== "undefined" ? window.innerWidth - 340 : position.x);
  const top = Math.min(position.y, typeof window !== "undefined" ? window.innerHeight - 200 : position.y);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-80 rounded-xl border-2 border-[#04261A] bg-white shadow-[4px_4px_0px_#04261A]"
      style={{ left, top }}
    >
      <div className="flex items-center justify-between border-b border-[#04261A]/10 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#04261A]/40">Contenu</span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              navigator.clipboard.writeText(value).then(() => toast("Copié !", "success")).catch(() => {});
            }}
            className="rounded p-1 text-[#04261A]/30 hover:bg-[#04261A]/5 hover:text-[#04261A]/60"
            title="Copier"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button onClick={onClose} className="rounded p-1 text-[#04261A]/30 hover:bg-[#04261A]/5 hover:text-[#04261A]/60">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="max-h-60 overflow-auto p-3">
        <p className="whitespace-pre-wrap text-xs text-[#04261A] leading-relaxed">{value}</p>
      </div>
    </div>
  );
}
