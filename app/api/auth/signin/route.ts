import { NextRequest, NextResponse } from "next/server";
import {
  authErrorMessage,
  setSessionCookies,
  supabaseAuthFetch,
  type AuthSession,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email =
    body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password =
    body && typeof body.password === "string" ? body.password : "";

  if (!email || !email.includes("@") || password.length < 6) {
    return NextResponse.json(
      { error: "Enter a valid email and password." },
      { status: 400 },
    );
  }

  try {
    const authResponse = await supabaseAuthFetch(
      "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        body: JSON.stringify({ email, password }),
      },
    );
    const payload = await authResponse.json().catch(() => null);

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: authErrorMessage(payload, "Unable to sign in.") },
        { status: authResponse.status === 400 ? 401 : authResponse.status },
      );
    }

    const session = payload as AuthSession;
    const response = NextResponse.json({ user: session.user });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to sign in." },
      { status: 503 },
    );
  }
}
