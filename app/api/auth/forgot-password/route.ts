import { NextRequest, NextResponse } from "next/server";
import { authErrorMessage, supabaseAuthFetch } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email =
    body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  try {
    const redirectTo = `${request.nextUrl.origin}/auth/reset-password`;
    const authResponse = await supabaseAuthFetch(
      `/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
      },
    );
    const payload = await authResponse.json().catch(() => null);

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: authErrorMessage(payload, "Unable to send reset email.") },
        { status: authResponse.status },
      );
    }

    return NextResponse.json({
      message: "If an account exists for that email, a reset link is on the way.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send reset email." },
      { status: 503 },
    );
  }
}
