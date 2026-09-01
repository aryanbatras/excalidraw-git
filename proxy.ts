export { auth as proxy } from "@/lib/auth";

export const config = {
  matcher: ["/((?!api|share|_next/static|_next/image|favicon.ico).*)"],
};
