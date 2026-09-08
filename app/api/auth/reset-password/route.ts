import { NextRequest, NextResponse } from "next/server";
import { authErrorMessage, supabaseAuthFetch } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const accessToken =
    body && typeof body.access_token === "string" ? body.access_token : "";
  const password =
    body && typeof body.password === "string" ? body.password : "";

  if (!accessToken) {
    return NextResponse.json(
      { error: "The reset link is invalid or expired." },
      { status: 400 },
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  try {
    const authResponse = await supabaseAuthFetch(
      "/auth/v1/user",
      {
        method: "PUT",
        body: JSON.stringify({ password }),
      },
      accessToken,
    );
    const payload = await authResponse.json().catch(() => null);

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: authErrorMessage(payload, "Unable to update password.") },
        { status: authResponse.status },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update password." },
      { status: 503 },
    );
  }
}
