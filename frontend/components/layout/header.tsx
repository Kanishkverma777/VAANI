'use client';

import React from 'react';
import Link from 'next/link';
import { Plus, RotateCw } from 'lucide-react';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  hideAction?: boolean;
  onRefresh?: () => void;
  loading?: boolean;
  size?: 'default' | 'large';
  className?: string;
}

export function Header({
  title,
  subtitle,
  action,
  hideAction = false,
  onRefresh,
  loading = false,
  className = '',
}: HeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#1a1a1a] ${className}`}
    >
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2.5">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-zinc-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        )}

        {hideAction || action === null ? null : action !== undefined ? (
          action
        ) : (
          <Link
            href="/dashboard/agents/new"
            prefetch={false}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs sm:text-[13px] font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>New agent</span>
          </Link>
        )}
      </div>
    </div>
  );
}

