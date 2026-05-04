"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { setAccessToken } from "@/lib/api";

export function TokenSync() {
  const { data: session } = useSession();
  useEffect(() => {
    setAccessToken((session as any)?.accessToken ?? null);
  }, [session]);
  return null;
}
