import React from "react";

interface LoaderProps {
  visible?: boolean;
  label?: string;
}

/** Web loading overlay used by the Vite application. */
export const Loader: React.FC<LoaderProps> = ({ visible = true, label = "Loading" }) => {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40" role="status" aria-live="polite">
      <div className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-xl">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-violet-300 border-t-transparent" aria-hidden="true" />
        {label}
      </div>
    </div>
  );
};
