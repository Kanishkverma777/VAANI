'use client';

import React from 'react';
import Link from 'next/link';
import { Bot, Mic, Trash2 } from 'lucide-react';
import { AgentRecord } from '@/types/agent';

interface AgentCardProps {
  agent: AgentRecord;
  onDelete?: (id: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  const config = agent.configuration || agent.config;
  const langs = [config?.language || 'en', ...(config?.additional_languages || [])];
  const isDeployed = Boolean(agent.elevenlabs_agent_id || agent.status === 'active');
  const useCaseLabel = agent.use_case
    ? agent.use_case.replace(/_/g, ' ')
    : config?.use_case
    ? String(config.use_case).replace(/_/g, ' ')
    : 'Customer Support';

  return (
    <div className="group relative bg-[#121215] hover:bg-[#16161a] rounded-2xl p-6 transition-all flex flex-col justify-between shadow-sm border-0">
      <div>
        {/* Header: Title, Category & Status */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#1c1c20] flex items-center justify-center text-zinc-300 shrink-0">
              <Bot className="w-5 h-5 text-zinc-200" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-white text-sm sm:text-[15px] truncate tracking-tight">
                {agent.name}
              </h3>
              <p className="text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-zinc-500 mt-0.5">
                {useCaseLabel}
              </p>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 ${
              isDeployed
                ? 'bg-emerald-950/40 text-emerald-400'
                : 'bg-[#1c1c20] text-zinc-400'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isDeployed ? 'bg-emerald-400' : 'bg-zinc-500'
              }`}
            />
            {isDeployed ? 'Active' : 'Draft'}
          </span>
        </div>

        {/* Description (2 lines clamp for clarity & legibility) */}
        <p className="text-xs sm:text-[13px] text-zinc-400 line-clamp-2 leading-relaxed my-3">
          {agent.description || config?.purpose || 'Conversational voice assistant.'}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5 my-3">
          {langs.map((l) => (
            <span
              key={l}
              className="px-2.5 py-1 rounded-lg bg-[#1c1c20] text-[11px] font-mono text-zinc-400 uppercase tabular-nums"
            >
              {l}
            </span>
          ))}
          <span className="px-2.5 py-1 rounded-lg bg-[#1c1c20] text-[11px] font-mono text-zinc-400">
            {config?.voice_id ? 'ElevenLabs Voice' : 'Standard'}
          </span>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-4 border-t border-white/[0.04] flex items-center justify-between gap-2.5 mt-2">
        <div className="flex items-center gap-2.5 flex-1">
          <Link
            href={`/dashboard/agents/${agent.id}`}
            prefetch={false}
            className="flex-1 text-center py-2.5 px-4 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-xs sm:text-[13px] font-medium text-zinc-200 transition-colors"
          >
            Workspace
          </Link>
          <Link
            href={`/dashboard/agents/${agent.id}/playground`}
            prefetch={false}
            className="flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl bg-white hover:bg-zinc-200 text-xs sm:text-[13px] font-semibold text-black transition-colors shadow-sm"
          >
            <Mic className="w-4 h-4 text-black" />
            <span>Test</span>
          </Link>
        </div>

        {onDelete && (
          <button
            onClick={() => {
              if (window.confirm(`Are you sure you want to delete "${agent.name}"?`)) {
                onDelete(agent.id);
              }
            }}
            title="Delete Agent"
            className="p-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

