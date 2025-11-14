import NextAuth from "@/app/lib/auth";

const handler = NextAuth;

export { handler as GET, handler as POST };

// Ensure this route is accessible
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';