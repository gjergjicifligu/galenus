import { NextRequest, NextResponse } from "next/server";
export function middleware(req: NextRequest) {
  // Keep saved legacy links useful while all current navigation uses Modules.
  if (/^\/(sq|en)\/webinars(?:\/|$)/.test(req.nextUrl.pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = url.pathname.replace("/webinars", "/modules");
    return NextResponse.redirect(url, 308);
  }
  const h = new Headers(req.headers);
  h.set("x-language", req.nextUrl.pathname.startsWith("/en") ? "en" : "sq");
  return NextResponse.next({ request: { headers: h } });
}
export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };
