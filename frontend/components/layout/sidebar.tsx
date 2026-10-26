'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Sparkles,
  Volume2,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Radio,
} from 'lucide-react';
import { clearStoredToken, getStoredUser } from '@/lib/api-client';
import { logoutUser, subscribeToAuth } from '@/lib/firebase';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);

  useEffect(() => {
    setUser(getStoredUser());
    const unsubscribe = subscribeToAuth((fbUser) => {
      if (fbUser) {
        setUser({
          email: fbUser.email || undefined,
          full_name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logoutUser();
    router.push('/login');
  };

  const navItems = [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Voice Agents', href: '/dashboard/agents', icon: Bot },
    { label: 'Create Agent', href: '/dashboard/agents/new', icon: Sparkles },
    { label: 'Voice Library', href: '/dashboard/voices', icon: Volume2 },
    { label: 'Knowledge Base', href: '/dashboard/knowledge', icon: BookOpen },
    { label: 'Analytics & Logs', href: '/dashboard/analytics', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  return (
    <aside className="w-[240px] border-r border-white/[0.04] bg-[#000000] flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Header */}
      <div className="h-16 border-b border-white/[0.04] px-6 flex items-center">
        <Link href="/dashboard" className="flex items-center gap-3">
          <img
            src="/logo-icon-white.png"
            alt="VAANI"
            className="h-7 w-auto object-contain"
          />
          <span className="font-semibold text-sm sm:text-base tracking-tight text-white">VAANI</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3.5 py-4 space-y-1 overflow-y-auto">
        <div className="text-[11px] font-medium uppercase tracking-wider text-zinc-500 px-3 pb-2 pt-1">
          Platform
        </div>
        {navItems.map((item) => {
          let isActive = false;
          if (item.href === '/dashboard') {
            isActive = pathname === '/dashboard';
          } else if (item.href === '/dashboard/agents') {
            isActive =
              pathname === '/dashboard/agents' ||
              (pathname.startsWith('/dashboard/agents/') && !pathname.startsWith('/dashboard/agents/new'));
          } else {
            isActive = pathname === item.href || pathname.startsWith(item.href);
          }
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-[13px] font-medium transition-colors ${
                isActive
                  ? 'bg-[#1c1c20] text-white font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-[#121215]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-4 border-t border-white/[0.04] bg-[#000000]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c20] flex items-center justify-center font-semibold text-xs sm:text-sm text-zinc-200 shrink-0">
              {user?.full_name ? user.full_name[0].toUpperCase() : 'K'}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-[13px] font-medium text-zinc-200 truncate">{user?.full_name || 'Kanishk'}</p>
              <p className="text-[11px] text-zinc-500 truncate">{user?.email || 'admin@vaani.ai'}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 text-zinc-500 hover:text-zinc-200 hover:bg-[#1c1c20] rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
