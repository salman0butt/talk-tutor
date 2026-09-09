import { NextResponse } from "next/server";
import { getAdminBillingAccountByUserId } from "@/lib/billing/admin-repository";
import { requireBillingIdentity } from "@/lib/billing/server";
import { createStripeBillingPortalSession } from "@/lib/billing/stripe";

export const runtime = "nodejs";

export async function POST() {
  try {
    const { userId } = await requireBillingIdentity();
    const account = await getAdminBillingAccountByUserId(userId);

    if (!account?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing customer exists for this account." },
        { status: 400 },
      );
    }

    const portal = await createStripeBillingPortalSession(
      account.stripeCustomerId,
    );
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "BillingAuthenticationError"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Billing portal could not be opened.",
      },
      { status: 503 },
    );
  }
}
