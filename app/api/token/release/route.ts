import { NextResponse } from "next/server";
import { releaseTutorSessionLease } from "@/lib/billing/admin-repository";
import { requireBillingIdentity } from "@/lib/billing/server";
import { isUuid } from "@/lib/learning/validation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const leaseId =
    body && typeof body === "object" && "leaseId" in body
      ? (body as { leaseId?: unknown }).leaseId
      : null;

  if (!isUuid(leaseId)) {
    return NextResponse.json({ error: "Invalid tutor lease." }, { status: 400 });
  }

  try {
    const { userId } = await requireBillingIdentity();
    const released = await releaseTutorSessionLease(userId, leaseId);
    return NextResponse.json({ released });
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "BillingAuthenticationError"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Tutor lease could not be released." },
      { status: 503 },
    );
  }
}
