import { useEffect } from "react";

export type StatusKind = "success" | "error" | "info";
export type Status = { kind: StatusKind; message: string } | null;

type Props = {
  status: Status;
  onClear: () => void;
  durationMs?: number;
};

const colorByKind: Record<StatusKind, string> = {
  success: "bg-emerald-500/15 border-emerald-500/30 text-emerald-200",
  error: "bg-red-500/15 border-red-500/30 text-red-200",
  info: "bg-blue-500/15 border-blue-500/30 text-blue-200",
};

export function StatusBanner({ status, onClear, durationMs = 3000 }: Props) {
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(onClear, durationMs);
    return () => clearTimeout(t);
  }, [status, onClear, durationMs]);

  if (!status) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 -translate-x-1/2 z-[990] rounded-2xl border px-4 py-2.5 text-sm shadow-xl backdrop-blur ${colorByKind[status.kind]}`}
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
    >
      {status.message}
    </div>
  );
}
