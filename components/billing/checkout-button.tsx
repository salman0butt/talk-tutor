"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import type { PaidPlanId } from "@/lib/billing/plans";

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

export function CheckoutButton({
  planId,
  children,
  className,
}: {
  planId: PaidPlanId;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function checkout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 401) {
        window.location.assign("/login?next=/pricing");
        return;
      }
      if (payload?.code === "subscription_exists") {
        window.location.assign("/billing");
        return;
      }
      if (!response.ok) {
        throw new Error(payload?.error ?? "Checkout could not be opened.");
      }

      navigateToStripe(payload?.url);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Checkout could not be opened.",
      );
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void checkout()}
        disabled={pending}
        className={
          className ??
          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 text-sm font-semibold text-black transition hover:bg-amber-300 disabled:opacity-60"
        }
      >
        {pending && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {children}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs leading-5 text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
