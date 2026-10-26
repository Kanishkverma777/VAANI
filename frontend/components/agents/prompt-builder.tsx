'use client';

import React, { useState } from 'react';
import { Sparkles, Loader2, Wand2 } from 'lucide-react';
import { UseCase } from '@/types/agent';
import { BUILDER_LANGUAGES } from '@/lib/languages';

interface PromptBuilderProps {
  onGenerate: (prompt: string, useCase: UseCase, preferredLanguage: string) => Promise<void>;
  isGenerating: boolean;
}

const TEMPLATES: Array<{
  title: string;
  tag: string;
  useCase: UseCase;
  text: string;
  languages: string[];
}> = [
  {
    title: 'Customer Support',
    tag: 'Support',
    useCase: 'customer_support',
    text: 'Create a calm, patient Tier 1 Technical Support agent for HyperLink broadband. It greets customers, troubleshoots blinking modem lights, guides callers through restarting routers, and escalates to a technician if line faults persist.',
    languages: ['en', 'hi'],
  },
  {
    title: 'Appointment Booking',
    tag: 'Appointments',
    useCase: 'appointments',
    text: 'Create a friendly bilingual (Hindi and English) dental receptionist for BrightSmile Dental. It greets patients, offers available morning and afternoon consultation slots, collects full name and callback number, and provides parking directions.',
    languages: ['hi', 'en'],
  },
  {
    title: 'Lead Generation',
    tag: 'Lead Gen',
    useCase: 'lead_generation',
    text: 'Build an energetic outbound sales assistant qualifying enterprise inbound leads for a B2B cloud software product. It asks about team size, current stack, and schedules a demo with an account executive.',
    languages: ['en'],
  },
  {
    title: 'Negotiation',
    tag: 'Deals',
    useCase: 'negotiation',
    text: 'Create a persuasive and strategic commercial negotiation voice assistant for freight logistics. It discusses pricing tiers, counter-offers volume discounts within approved margins, and closes service commitments smoothly.',
    languages: ['en'],
  },
  {
    title: 'Collections',
    tag: 'Finance',
    useCase: 'collections',
    text: 'Build a courteous and compliance-governed payment reminder specialist for outstanding invoices. It verifies caller identity safely, explains due dates, offers structured payment plans, and logs settlement agreements politely.',
    languages: ['en', 'hi'],
  },
  {
    title: 'Restaurant Assistant',
    tag: 'Hospitality',
    useCase: 'restaurant',
    text: 'Create an upbeat order-taking assistant for Bella Napoli Pizza. It asks for pizza size, crust, and toppings, quotes total price, checks delivery address, and answers store opening hours.',
    languages: ['en'],
  },
];

export function PromptBuilder({ onGenerate, isGenerating }: PromptBuilderProps) {
  const [prompt, setPrompt] = useState<string>('');
  const [selectedUseCase, setSelectedUseCase] = useState<UseCase>('customer_support');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');

  const MAX_PROMPT_LENGTH = 1000;

  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setPrompt(tmpl.text);
    setSelectedUseCase(tmpl.useCase);
    setSelectedLanguage(tmpl.languages[0] || 'en');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isGenerating) return;
    onGenerate(prompt, selectedUseCase, selectedLanguage);
  };

  return (
    <div className="bg-[#121215] rounded-2xl p-6 shadow-sm border-0 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.04] pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-400 font-medium text-[11px] uppercase tracking-wider mb-1">
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>Prompt generator</span>
          </div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            What kind of voice assistant do you want to create?
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Describe the persona, duties, and tone in plain words.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, MAX_PROMPT_LENGTH))}
              maxLength={MAX_PROMPT_LENGTH}
              rows={4}
              placeholder="Describe your agent in plain words..."
              className="w-full bg-[#1c1c20] rounded-xl p-3.5 pr-4 pb-7 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none transition-all resize-none border-0 focus:ring-1 focus:ring-white/20"
            />

            <div className="absolute right-3 bottom-2 text-[10px] font-mono text-zinc-500 tabular-nums">
              <span className={prompt.length >= MAX_PROMPT_LENGTH ? 'text-amber-400 font-semibold' : ''}>
                {prompt.length}
              </span>{' '}
              / {MAX_PROMPT_LENGTH} chars
            </div>
          </div>
        </div>

        {/* Template Chips */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-zinc-400">
              Quick templates
            </span>
            <span className="text-[11px] text-zinc-500 flex items-center gap-1">
              <Wand2 className="w-3 h-3 text-zinc-500" /> Click to auto-fill
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.title}
                type="button"
                onClick={() => handleApplyTemplate(t)}
                className={`text-left p-3 rounded-xl border-0 transition-colors ${
                  selectedUseCase === t.useCase && prompt === t.text
                    ? 'bg-[#2a2a32] text-white shadow-sm'
                    : 'bg-[#1c1c20] hover:bg-[#222228] text-zinc-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-200 truncate">
                    {t.title}
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-[#121215] text-zinc-400 border-0 ml-1 shrink-0">
                    {t.tag}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Target Languages */}
        <div className="pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-medium">Primary language:</span>
            {BUILDER_LANGUAGES.map((lang) => {
              const active = selectedLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setSelectedLanguage(lang.code)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase transition-colors border-0 ${
                    active
                      ? 'bg-white text-black'
                      : 'bg-[#1c1c20] text-zinc-400 hover:text-white'
                  }`}
                >
                  {lang.code}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Generate agent</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
