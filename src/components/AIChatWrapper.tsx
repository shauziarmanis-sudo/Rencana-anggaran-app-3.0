'use client';

import dynamic from 'next/dynamic';

const AIChatPanel = dynamic(() => import('./AIChatPanel'), { ssr: false });

export default function AIChatWrapper() {
  return <AIChatPanel />;
}
