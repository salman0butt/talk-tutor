"use client";

import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAudioStore } from "@/store/useAudioStore";
import { ConnectionState } from "@/types";

const STATUS_COPY: Record<ConnectionState, string> = {
  [ConnectionState.DISCONNECTED]: "Ready to Talk",
  [ConnectionState.REQUESTING_PERMISSION]: "Waiting for Microphone",
  [ConnectionState.CONNECTING]: "Connecting...",
  [ConnectionState.CONNECTED]: "Live Session",
  [ConnectionState.DISCONNECTING]: "Ending Session...",
  [ConnectionState.ERROR]: "Connection Error",
};

function StatusPanel() {
  const { connectionState, error } = useAudioStore();

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isBusy =
    connectionState === ConnectionState.CONNECTING ||
    connectionState === ConnectionState.REQUESTING_PERMISSION ||
    connectionState === ConnectionState.DISCONNECTING;
  const isError = connectionState === ConnectionState.ERROR;

  return (
    <div className="pointer-events-none absolute left-0 right-0 top-6 z-20 flex flex-col items-center gap-4">
      {error && (
        <div
          role="alert"
          className="pointer-events-auto flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 shadow-lg animate-in fade-in slide-in-from-top-4 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
        >
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div
        className={cn(
          "flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-widest shadow-sm backdrop-blur-sm transition-all duration-500",
          isBusy
            ? "border-blue-200 bg-blue-50 text-blue-600 animate-pulse dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400"
            : isConnected
              ? "border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400"
              : isError
                ? "border-red-200 bg-red-50 text-red-600 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400"
                : "border-amber-200 bg-amber-50 text-amber-700 dark:border-[#ffa809]/20 dark:bg-[#ffa809]/10 dark:text-[#ffa809]",
        )}
      >
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            isBusy
              ? "bg-blue-500"
              : isConnected
                ? "bg-emerald-500"
                : isError
                  ? "bg-red-500"
                  : "bg-[#ffa809]",
          )}
        />
        {STATUS_COPY[connectionState]}
      </div>
    </div>
  );
}

export default StatusPanel;
