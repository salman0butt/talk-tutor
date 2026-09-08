import { NextRequest, NextResponse } from "next/server";
import {
  authErrorMessage,
  setSessionCookies,
  supabaseAuthFetch,
  type AuthSession,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name =
    body && typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  const email =
    body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password =
    body && typeof body.password === "string" ? body.password : "";

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Please enter your name." },
      { status: 400 },
    );
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
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
    const redirectTo = `${request.nextUrl.origin}/auth/callback`;
    const authResponse = await supabaseAuthFetch(
      `/auth/v1/signup?redirect_to=${encodeURIComponent(redirectTo)}`,
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          data: { full_name: name },
        }),
      },
    );
    const payload = await authResponse.json().catch(() => null);

    if (!authResponse.ok) {
      return NextResponse.json(
        { error: authErrorMessage(payload, "Unable to create your account.") },
        { status: authResponse.status },
      );
    }

    const session = payload as AuthSession;

    if (!session.access_token) {
      return NextResponse.json(
        {
          needsEmailConfirmation: true,
          message: "Check your inbox to confirm your email, then sign in.",
        },
        { status: 201 },
      );
    }

    const response = NextResponse.json({ user: session.user }, { status: 201 });
    setSessionCookies(response, session);
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create account.",
      },
      { status: 503 },
    );
  }
}
