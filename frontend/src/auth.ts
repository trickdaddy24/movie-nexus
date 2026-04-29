import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import { verify } from "@node-rs/bcrypt";
import { authConfig } from "./auth.config";

const prisma = new PrismaClient();

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        // Superadmin check — env only, never touches the database
        const saEmail = process.env.SUPERADMIN_EMAIL;
        const saPassword = process.env.SUPERADMIN_PASSWORD;
        if (saEmail && saPassword && email === saEmail && password === saPassword) {
          return { id: "superadmin", name: "Superadmin", email: saEmail, role: "superadmin" };
        }

        // Regular DB user
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.password) return null;
        const valid = await verify(password, user.password);
        if (!valid) return null;
        if (user.status !== "approved") return null;

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "admin";
      }
      // Re-fetch role on refresh — skip for superadmin (no DB row)
      if (token.id && token.id !== "superadmin") {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: { role: true, status: true },
          });
          if (!dbUser || dbUser.status !== "approved") {
            token.id = undefined;
            token.role = undefined;
          } else {
            token.role = dbUser.role;
          }
        } catch {
          // DB unavailable — keep existing token
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = (token.role as string) ?? "admin";
      }
      return session;
    },
  },
});
