import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Page routes
    "/dashboard/:path*",
    "/transactions/:path*",
    "/documents/:path*",
    "/bank/:path*",
    "/reports/:path*",
    "/accounts/:path*",
    "/tax/:path*",
    "/settings/:path*",
    "/invoices/:path*",
    // API routes (except /api/auth/* which must be public for login/register)
    "/api/accounts/:path*",
    "/api/transactions/:path*",
    "/api/documents/:path*",
    "/api/bank/:path*",
    "/api/reports/:path*",
    "/api/export/:path*",
    "/api/settings/:path*",
  ],
};
