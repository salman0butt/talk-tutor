import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  clearSessionCookies,
  isAuthConfigured,
  supabaseAuthFetch,
} from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;

  if (accessToken && isAuthConfigured()) {
    await supabaseAuthFetch(
      "/auth/v1/logout",
      { method: "POST" },
      accessToken,
    ).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  clearSessionCookies(response);
  return response;
}
