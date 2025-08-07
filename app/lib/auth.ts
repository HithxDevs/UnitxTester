import NextAuth from "next-auth";
import GithubProvider from "next-auth/providers/github";

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || "",
      clientSecret: process.env.GITHUB_SECRET || "",
      authorization: {
        params: {
          scope: "read:user user:email repo" // Add repo scope to access repositories
        }
      }
    }),
  ],
  callbacks: {
    async jwt({ token, account } : { token: any; account: any }) {
      // Save the access token to the token right after signin
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      if (session.user) {
        session.user.id = token.sub || "";
        // Add access token to session so it can be used in components
        session.accessToken = token.accessToken;
      }
      return session;
    },
  },
};

export default NextAuth(authOptions);
export { authOptions };