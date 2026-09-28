import type { ReactNode } from 'react';

import { SiteHeader } from '@/components/home/site-header';
import { ChatbotWidget } from '@/components/chatbot/chatbot-widget';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="w-full py-4 sm:py-6">
        {children}
      </main>
      <ChatbotWidget />
    </>
  );
}
