"use client";

import { useSession, signOut } from "next-auth/react";

export default function SignOutButton() {
  const { data: session } = useSession();
  if (!session) return null;

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-sm text-nexus-muted hover:text-red-500 dark:hover:text-red-400 transition"
    >
      Sign out
    </button>
  );
}
