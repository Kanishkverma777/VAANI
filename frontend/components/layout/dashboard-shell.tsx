'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './sidebar';
import { getStoredToken } from '@/lib/api-client';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [mounted, setMounted] = useState<boolean>(false);

  useEffect(() => {
    setMounted(true);
    const token = getStoredToken();
    if (!token) {
      router.push('/login');
    }
  }, [router]);

  return (
    <div className="flex min-h-screen bg-[#000000] text-zinc-100 antialiased font-sans">
      <Suspense fallback={<aside className="w-64 border-r border-[#222222] bg-[#000000] shrink-0" />}>
        <Sidebar />
      </Suspense>
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto relative">
        {!mounted && (
          <div className="absolute inset-0 z-50 bg-[#000000] flex items-center justify-center text-zinc-500 text-xs">
            Loading VAANI...
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
