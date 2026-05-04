import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const session = req.auth;
  const { pathname } = req.nextUrl;

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const role = session.user?.role ?? "";

  if (pathname.startsWith("/admin") && !["ADMIN", "SUPERADMIN"].includes(role)) {
    return NextResponse.redirect(new URL("/employee", req.url));
  }

  if (
    pathname.startsWith("/manager") &&
    !["MANAGER", "ADMIN", "SUPERADMIN", "HR"].includes(role)
  ) {
    return NextResponse.redirect(new URL("/employee", req.url));
  }

  if (
    pathname.startsWith("/hr") &&
    role !== "HR"
  ) {
    return NextResponse.redirect(new URL("/employee", req.url));
  }
});

export const config = {
  matcher: [
    "/admin/:path*",
    "/employee/:path*",
    "/manager/:path*",
    "/hr/:path*",
    "/support/:path*",
  ],
};
