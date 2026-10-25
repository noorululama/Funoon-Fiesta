import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_COOKIE, JURY_COOKIE, TEAM_COOKIE, JWT_SECRET } from "./src/lib/config";

const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

async function verifyToken(token: string | undefined) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload;
  } catch (err) {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Admin Protection
  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      const token = request.cookies.get(ADMIN_COOKIE)?.value;
      const payload = await verifyToken(token);
      if (payload?.role === "admin") {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url));
      }
      return NextResponse.next();
    }

    const token = request.cookies.get(ADMIN_COOKIE)?.value;
    const payload = await verifyToken(token);

    if (!payload || payload.role !== "admin") {
      const url = new URL("/admin/login", request.url);
      return NextResponse.redirect(url);
    }
  }

  // 2. Jury Protection
  if (pathname.startsWith("/jury")) {
    if (pathname === "/jury/login") {
      const token = request.cookies.get(JURY_COOKIE)?.value;
      const payload = await verifyToken(token);
      if (payload?.role === "jury") {
        return NextResponse.redirect(new URL("/jury/programs", request.url));
      }
      return NextResponse.next();
    }

    const token = request.cookies.get(JURY_COOKIE)?.value;
    const payload = await verifyToken(token);

    if (!payload || payload.role !== "jury") {
      const url = new URL("/jury/login", request.url);
      return NextResponse.redirect(url);
    }
  }

  // 3. Team Protection
  if (pathname.startsWith("/team")) {
    if (pathname === "/team/login") {
      const token = request.cookies.get(TEAM_COOKIE)?.value;
      const payload = await verifyToken(token);
      if (payload?.role === "team") {
        return NextResponse.redirect(new URL("/team/dashboard", request.url));
      }
      return NextResponse.next();
    }

    const token = request.cookies.get(TEAM_COOKIE)?.value;
    const payload = await verifyToken(token);

    if (!payload || payload.role !== "team") {
      const url = new URL("/team/login", request.url);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/jury/:path*", "/team/:path*"],
};

