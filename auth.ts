import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const BACKEND = process.env.NEXT_PUBLIC_API_URL ?? "http://3.108.234.187:3000";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:     { label: "Email",     type: "email"    },
        password:  { label: "Password",  type: "password" },
        latitude:  { label: "Latitude",  type: "text"     },
        longitude: { label: "Longitude", type: "text"     },
        browser:   { label: "Browser",   type: "text"     },
        system:    { label: "System",    type: "text"     },
      },
      async authorize(credentials) {
        try {
          const res = await fetch(`${BACKEND}/auth/login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email:     credentials.email,
              password:  credentials.password,
              latitude:  Number(credentials.latitude  ?? 0),
              longitude: Number(credentials.longitude ?? 0),
              browser:   credentials.browser  ?? "Unknown",
              system:    credentials.system   ?? "Unknown",
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          const token: string = data.access_token ?? data.token ?? data.accessToken;
          if (!token) return null;

          const payload = JSON.parse(atob(token.split(".")[1]));

          return {
            id:          String(payload.sub ?? payload.id ?? ""),
            name:        payload.name  ?? "",
            email:       payload.email ?? "",
            role:        payload.role  ?? "",
            accessToken: token,
          };
        } catch {
          return null;
        }
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id          = user.id;
        token.role        = (user as any).role;
        token.accessToken = (user as any).accessToken;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id   = token.id as string;
      session.user.role = token.role as string;
      (session as any).accessToken = token.accessToken;
      return session;
    },
  },

  pages:   { signIn: "/login" },
  session: { strategy: "jwt" },
  secret:  process.env.NEXTAUTH_SECRET ?? "nexus-placeholder-secret",
});
