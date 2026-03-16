"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

let _toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast: addToast }}>
      {children}
      {/* Toast container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-center gap-2 rounded-xl border-2 border-[#04261A] bg-white px-4 py-2.5 shadow-[3px_3px_0px_#04261A] animate-in slide-in-from-right-5 fade-in duration-200 ${
                t.type === "error" ? "border-red-500 shadow-[3px_3px_0px_#ef4444]" : ""
              }`}
            >
              {t.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#00DF82]" />}
              {t.type === "error" && <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />}
              {t.type === "info" && <Info className="h-4 w-4 shrink-0 text-[#04261A]/50" />}
              <span className="text-xs font-medium text-[#04261A]">{t.message}</span>
              <button onClick={() => dismiss(t.id)} className="ml-1 shrink-0 rounded p-0.5 text-[#04261A]/30 hover:text-[#04261A]/60">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
