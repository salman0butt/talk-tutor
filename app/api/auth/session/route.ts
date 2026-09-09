import { NextRequest, NextResponse } from "next/server";
import {
  authErrorMessage,
  setSessionCookies,
  supabaseAuthFetch,
  type AuthSession,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const accessToken =
    body && typeof body.access_token === "string" ? body.access_token : "";
  const refreshToken =
    body && typeof body.refresh_token === "string" ? body.refresh_token : undefined;
  const expiresIn =
    body && typeof body.expires_in === "number" ? body.expires_in : 3600;

  if (!accessToken) {
    return NextResponse.json({ error: "Missing session token." }, { status: 400 });
  }

  try {
    const userResponse = await supabaseAuthFetch(
      "/auth/v1/user",
      { method: "GET" },
      accessToken,
    );
    const payload = await userResponse.json().catch(() => null);

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: authErrorMessage(payload, "Invalid or expired session.") },
        { status: 401 },
      );
    }

    const response = NextResponse.json({ user: payload });
    setSessionCookies(response, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      user: payload,
    } satisfies AuthSession);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save session." },
      { status: 503 },
    );
  }
}
