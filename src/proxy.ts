import withAuth from "next-auth/middleware";

export default withAuth({
  pages: { signIn: "/login" },
});

export const config = {
  matcher: [
    "/((?!login(?:/|$)|signup(?:/|$)|invite(?:/|$)|forgot-password(?:/|$)|reset-password(?:/|$)|api/password-reset(?:/|$)|api/auth(?:/|$)|api/seed(?:/|$)|api/signup(?:/|$)|api/invites/token(?:/|$)|api/webhooks(?:/|$)|api/health(?:/|$)|_next/static(?:/|$)|_next/image(?:/|$)|favicon\\.ico$|robots\\.txt$|opengraph-image|twitter-image|$).*)",
  ],
};
