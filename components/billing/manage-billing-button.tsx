"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";

function navigateToStripe(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Billing destination was missing.");
  }
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    !(url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com"))
  ) {
    throw new Error("Billing destination was invalid.");
  }
  window.location.assign(url.toString());
}

export function ManageBillingButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function openPortal() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", {
        method: "POST",
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Billing portal could not be opened.");
      }
      navigateToStripe(payload?.url);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Billing portal could not be opened.",
      );
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void openPortal()}
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white transition hover:bg-white/[0.07] disabled:opacity-60"
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        Manage subscription
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
