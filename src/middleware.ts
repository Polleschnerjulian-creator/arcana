export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/transactions/:path*",
    "/documents/:path*",
    "/bank/:path*",
    "/reports/:path*",
    "/accounts/:path*",
    "/tax/:path*",
    "/settings/:path*",
  ],
};
