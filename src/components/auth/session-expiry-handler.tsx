'use client';

import { useEffect } from 'react';

import { useSession } from 'next-auth/react';

import { logout } from '@/services/auth.service';

export function SessionExpiryHandler() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.sessionExpiresAt) {
      return;
    }

    const remainingTime = session.user.sessionExpiresAt - Date.now();

    if (remainingTime <= 0) {
      logout();
      return;
    }

    const timer = window.setTimeout(() => {
      logout();
    }, remainingTime);

    return () => {
      window.clearTimeout(timer);
    };
  }, [session, status]);

  return null;
}
