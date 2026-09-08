import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearSessionCookies,
  setSessionCookies,
  supabaseAuthFetch,
  type AuthSession,
} from "@/lib/auth";

function unauthorizedResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (accessToken) {
    try {
      const userResponse = await supabaseAuthFetch(
        "/auth/v1/user",
        { method: "GET" },
        accessToken,
      );

      if (userResponse.ok) {
        return NextResponse.next();
      }
    } catch {
      // Fall through to refresh or unauthorized handling.
    }
  }

  if (refreshToken) {
    try {
      const refreshResponse = await supabaseAuthFetch(
        "/auth/v1/token?grant_type=refresh_token",
        {
          method: "POST",
          body: JSON.stringify({ refresh_token: refreshToken }),
        },
      );
      const session = (await refreshResponse.json().catch(() => null)) as
        | AuthSession
        | null;

      if (refreshResponse.ok && session?.access_token) {
        const response = NextResponse.redirect(request.nextUrl);
        setSessionCookies(response, session);
        return response;
      }
    } catch {
      // Invalid or expired refresh token is handled below.
    }
  }

  const response = unauthorizedResponse(request);
  clearSessionCookies(response);
  return response;
}

export const config = {
  matcher: ["/tutor/:path*", "/api/token"],
};
