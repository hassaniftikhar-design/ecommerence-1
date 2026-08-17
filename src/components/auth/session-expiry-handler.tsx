"use client";

import { useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

export function SessionExpiryHandler() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== "authenticated" || !session?.user?.sessionExpiresAt) {
      return;
    }

    const remainingTime = session.user.sessionExpiresAt - Date.now();

    if (remainingTime <= 0) {
      signOut({ redirect: false });
      return;
    }

    const timer = window.setTimeout(() => {
      signOut({ redirect: false });
    }, remainingTime);

    return () => {
      window.clearTimeout(timer);
    };
  }, [session, status]);

  return null;
}
