// Minimal NextAuth v5 config.
// This project uses its own JWT auth via the NestJS backend.
// This stub exists only to satisfy the [...nextauth] route handler.
import NextAuth from "next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [],
  secret: process.env.NEXTAUTH_SECRET ?? "nexus-placeholder-secret",
});
