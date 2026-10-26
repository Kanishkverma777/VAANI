'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { AgentCard } from '@/components/agents/agent-card';
import { useAgents } from '@/hooks/use-agents';
import {
  Bot,
  Plus,
  Search,
  RotateCw,
  Loader2,
} from 'lucide-react';
import { AgentRecord } from '@/types/agent';

export default function AgentsPage() {
  const { agents: fetchedAgents, loading, refresh, removeAgent } = useAgents();
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const displayedAgents = useMemo(() => {
    const list = fetchedAgents || [];
    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter((a) => {
      const matchesName = a.name.toLowerCase().includes(q);
      const matchesDesc = (a.description || '').toLowerCase().includes(q);
      const matchesLang = (a.configuration?.language || '').toLowerCase().includes(q);
      return matchesName || matchesDesc || matchesLang;
    });
  }, [fetchedAgents, searchQuery]);

  const handleDeleteAgent = async (agent: AgentRecord) => {
    if (!confirm(`Are you sure you want to delete "${agent.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      setDeletingId(agent.id);
      await removeAgent(agent.id);
      await refresh();
    } catch (err) {
      console.error('Failed to delete agent:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000] text-zinc-100">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full space-y-6">
        <Header
          title="Voice agents"
          subtitle="Manage, configure, and test conversational assistants."
          onRefresh={refresh}
          loading={loading}
        />
        {/* Search & Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm sm:text-base font-semibold text-white tracking-tight">Active Fleet</h2>
            <span className="text-xs font-mono px-2.5 py-0.5 rounded-lg bg-[#1c1c20] text-zinc-400">
              {displayedAgents.length}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Search Input */}
            <div className="relative min-w-[240px] sm:min-w-[280px]">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-[13px] text-white placeholder-zinc-500 outline-none border-0 focus:ring-1 focus:ring-white/20 transition-colors"
              />
            </div>

            <button
              onClick={() => refresh()}
              disabled={loading}
              className="p-2.5 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-zinc-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <RotateCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Section */}
        {loading && displayedAgents.length === 0 ? (
          <div className="p-16 text-center text-zinc-500 text-xs sm:text-sm flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-zinc-400" />
            <span>Loading voice agents...</span>
          </div>
        ) : displayedAgents.length > 0 ? (
          <div className={`grid grid-cols-1 md:grid-cols-2 ${displayedAgents.length > 2 ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-4`}>
            {displayedAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onDelete={() => handleDeleteAgent(agent)}
              />
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="bg-[#121215] rounded-2xl p-10 sm:p-14 text-center space-y-4 shadow-sm border-0">
            <div className="w-10 h-10 rounded-xl bg-[#1c1c20] flex items-center justify-center mx-auto text-zinc-300">
              <Bot className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">No agents found</h3>
              {searchQuery && (
                <p className="text-xs text-zinc-400 mt-1 max-w-sm mx-auto">
                  No voice agents match your search term.
                </p>
              )}
            </div>

            {!searchQuery && (
              <div className="pt-2 flex justify-center">
                <Link
                  href="/dashboard/agents/new"
                  className="px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors inline-flex items-center gap-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create agent</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
