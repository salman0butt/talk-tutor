"use client";

import { useRouter } from "next/navigation";
import { LoaderCircle, RotateCcw } from "lucide-react";
import { useState } from "react";

export function FeedbackRetryButton({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function retry() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/learning/sessions/${sessionId}/feedback`,
        { method: "POST" },
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const detail =
          process.env.NODE_ENV === "development" &&
          typeof payload?.detail === "string"
            ? ` ${payload.detail}`
            : "";
        throw new Error(
          `${payload?.error ?? "Feedback retry failed."}${detail}`,
        );
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feedback retry failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={retry}
        disabled={pending}
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 px-3 text-xs font-medium text-white/65 transition hover:bg-white/[0.05] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RotateCcw className="h-3.5 w-3.5" />
        )}
        {pending ? "Generating…" : "Retry feedback"}
      </button>
      {error && (
        <p className="mt-2 max-w-sm text-xs text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
