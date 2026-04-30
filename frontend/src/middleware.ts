import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const BYPASS_TOKEN = process.env.ADMIN_BYPASS_TOKEN || "";
const BYPASS_COOKIE = "nexus_bypass";
const BYPASS_MAX_AGE = 86400; // 24 hours

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function verifyBypassCookie(cookieValue: string): boolean {
  if (!BYPASS_TOKEN || !cookieValue) return false;
  return cookieValue === BYPASS_TOKEN;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Bypass token flow — only for /admin routes
  if (isAdminRoute(pathname)) {
    const bypassParam = searchParams.get("bypass");

    // If ?bypass=TOKEN is in URL, validate and set cookie
    if (bypassParam && BYPASS_TOKEN && bypassParam === BYPASS_TOKEN) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("bypass");
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set(BYPASS_COOKIE, BYPASS_TOKEN, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: BYPASS_MAX_AGE,
        path: "/admin",
      });
      return response;
    }

    // If bypass cookie exists and is valid, allow access
    const bypassCookie = request.cookies.get(BYPASS_COOKIE)?.value;
    if (verifyBypassCookie(bypassCookie || "")) {
      return NextResponse.next();
    }
  }

  // Clear bypass cookie on /login
  if (pathname === "/login") {
    const response = NextResponse.next();
    response.cookies.delete(BYPASS_COOKIE);
    return response;
  }

  // Fall through to Auth.js middleware for normal auth
  return (auth as unknown as (req: NextRequest) => Promise<NextResponse>)(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
