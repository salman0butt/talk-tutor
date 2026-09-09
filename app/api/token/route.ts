import { AuthToken, GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import {
  acquireTutorSessionLease,
  releaseTutorSessionLease,
} from "@/lib/billing/admin-repository";
import { requireBillingIdentity } from "@/lib/billing/server";
import { buildTutorTokenPolicy } from "@/lib/billing/token-policy";

function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini Live is not configured.");
  }
  return new GoogleGenAI({ apiKey });
}

export async function GET() {
  try {
    const { userId, repository } = await requireBillingIdentity();
    const entitlement = await repository.getEntitlement();
    const sessionPolicy = buildTutorTokenPolicy({
      remainingSeconds: entitlement.remainingSeconds,
    });

    if (!sessionPolicy.allowed) {
      return NextResponse.json(
        {
          error:
            "You have used your conversation allowance for this billing period.",
          code: "usage_limit",
          entitlement,
          sessionPolicy,
        },
        { status: 402 },
      );
    }

    const leaseId = await acquireTutorSessionLease(
      userId,
      sessionPolicy.maxSessionSeconds,
    );

    if (!leaseId) {
      return NextResponse.json(
        {
          error:
            "A live tutor session is already active for this account. End it or wait for it to expire.",
          code: "concurrent_session",
        },
        { status: 409 },
      );
    }

    try {
      const now = Date.now();
      const expireTime = new Date(
        now + (sessionPolicy.maxSessionSeconds + 120) * 1000,
      ).toISOString();

      const token: AuthToken = await createGeminiClient().authTokens.create({
        config: {
          uses: 1,
          expireTime,
          newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
          httpOptions: { apiVersion: "v1alpha" },
        },
      });

      return NextResponse.json({
        token,
        leaseId,
        entitlement,
        sessionPolicy,
      });
    } catch (error) {
      await releaseTutorSessionLease(userId, leaseId).catch(() => false);
      console.error(
        "[Tutor token] Gemini token creation failed:",
        error instanceof Error ? error.message : "unknown error",
      );
      return NextResponse.json(
        {
          error: "Could not authorize a live tutor session. Please try again.",
          code: "token",
        },
        { status: 503 },
      );
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === "BillingAuthenticationError"
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.error(
      "[Tutor token] entitlement check failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      {
        error: "Live tutor authorization is temporarily unavailable.",
        code: "token",
      },
      { status: 503 },
    );
  }
}
