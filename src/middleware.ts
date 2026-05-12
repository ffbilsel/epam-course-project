import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register", "/api/auth", "/_next", "/favicon.ico"];

/**
 * Edge middleware that redirects unauthenticated requests for app
 * routes to `/login?callbackUrl=...`. NextAuth session cookie
 * presence is treated as a soft signal only; route handlers and RSC
 * pages still call {@link requireSession} for hard enforcement.
 */
export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const sessionCookie =
    req.cookies.get("authjs.session-token") ?? req.cookies.get("__Secure-authjs.session-token");
  if (!sessionCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?callbackUrl=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
