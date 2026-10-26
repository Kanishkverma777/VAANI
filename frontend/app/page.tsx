'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import SculptureHero from '@/components/ui/liquid-sculpture-hero';
import HalftoneWordmarkFooter from '@/components/ui/halftone-wordmark-footer';
import {
  Mic,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Globe2,
  BookOpen,
  BarChart3,
  Check,
} from 'lucide-react';

export default function LandingPage() {
  const [demoPrompt] = useState(
    'Create a friendly AI receptionist that speaks Hindi and English and handles appointments.'
  );

  return (
    <div className="min-h-screen bg-[#000000] text-zinc-100 selection:bg-zinc-800 selection:text-white">
      {/* Liquid Sculpture Interactive WebGL Hero */}
      <SculptureHero
        brand="VAANI"
        logoSrc="/logo-icon-white.png"
        logoHeight={40}
        eyebrow="Conversational Voice AI Platform"
        headline={"No-Code\nVoice AI Agent.\nBuilder Platform."}
        headlineAccent="Builder Platform."
        body={
          <>
            Describe your idea. Create an internal voice agent. Test it live in the playground. Deploy it seamlessly with <strong>ElevenLabs</strong>.
          </>
        }
        primaryCta={{ label: "Build Your First Agent", href: "/dashboard/agents/new" }}
        secondaryCta={{ label: "Explore Platform", href: "#demo" }}
        navLinks={[
          { label: "Features", href: "#features" },
          { label: "Interactive Demo", href: "#demo" },
          { label: "Use Cases", href: "#use-cases" },
        ]}
        themeToggle={false}
        showNav={true}
        theme="dark"
        background="#000000"
        darkBackground="#000000"
        textColor="#FFFFFF"
        accentColor="#FAFAFA"
        backdropText="VAANI"
        height="100svh"
        interactive={true}
        ambient={true}
        ambientIntensity={0.8}
        showCredit={false}
      />

      {/* Interactive Demonstration Section */}
      <section id="demo" className="py-20 px-6 max-w-4xl mx-auto">
        <div className="bg-[#121215] rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-5 pb-4 border-b border-white/[0.04]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Interactive Demonstration
            </span>
            <span className="text-xs text-zinc-500">Natural Language Prompt-to-Agent</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            <div className="space-y-3">
              <label className="text-xs font-medium uppercase text-zinc-400 block">
                Sample Natural Language Prompt:
              </label>
              <div className="p-4 rounded-xl bg-[#1c1c20] text-xs text-zinc-200 font-medium leading-relaxed">
                "{demoPrompt}"
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                VAANI turns this prompt into a structured, production-ready ElevenLabs conversational agent specification in seconds.
              </p>
              <Link
                href="/dashboard/agents/new"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-white hover:text-zinc-300 transition-colors"
              >
                <span>Try this prompt in Builder</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Generated Preview Card */}
            <div className="p-5 rounded-xl bg-[#1c1c20] space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between text-[11px] text-zinc-400 border-b border-white/[0.06] pb-2.5">
                <span className="text-orange-400 font-medium flex items-center gap-1">
                  <Check className="w-3 h-3" /> Agent Config Generated
                </span>
                <span>Latency: 280ms</span>
              </div>
              <div>
                <span className="text-zinc-500">Name:</span> <span className="text-white">BrightSmile Dental Receptionist</span>
              </div>
              <div>
                <span className="text-zinc-500">Languages:</span> <span className="text-zinc-200">English, Hindi</span>
              </div>
              <div>
                <span className="text-zinc-500">Welcome:</span>
                <p className="text-zinc-300 font-sans text-xs mt-1.5 bg-[#121215] p-3 rounded-lg">
                  "Namaste and hello! Welcome to BrightSmile Dental. How may I assist you with your appointment today?"
                </p>
              </div>
              <div className="pt-2 flex items-center justify-between text-[11px]">
                <span className="text-zinc-500">ElevenLabs ConvAI</span>
                <span className="text-white font-medium">Ready to Deploy</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Showcase */}
      <section id="features" className="py-14 px-6 max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-white tracking-tight mb-2">
            Full-Lifecycle Conversational AI Platform
          </h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Everything needed to go from natural language prompt to deployed web and telephone voice assistants.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-2xl bg-[#121215]">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c20] text-zinc-200 flex items-center justify-center mb-4">
              <Sparkles className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Prompt-to-Agent</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Generate agent personas, guardrails, conversation flows, and tool definitions automatically.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215]">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c20] text-zinc-200 flex items-center justify-center mb-4">
              <Zap className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Voice Playground</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Test low-latency voice conversations directly in your browser with live waveforms and transcripts.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215]">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c20] text-zinc-200 flex items-center justify-center mb-4">
              <Globe2 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Multilingual Agents</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Switch between Hindi, English, Spanish, and 20+ languages with ElevenLabs realistic voice models.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215]">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c20] text-zinc-200 flex items-center justify-center mb-4">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Knowledge-Grounded (RAG)</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Upload PDF and TXT documents. Agents ground answers strictly in verified company documentation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215]">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c20] text-zinc-200 flex items-center justify-center mb-4">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">7-Category Benchmark</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Evaluate voice quality, prompt safety, fallback handling, and latency compliance before publishing.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#121215]">
            <div className="w-9 h-9 rounded-xl bg-[#1c1c20] text-zinc-200 flex items-center justify-center mb-4">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h3 className="font-semibold text-white text-sm mb-1">Observability & Logs</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Inspect session duration, completion rate, resolution status, and full conversational event logs.
            </p>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-12 px-6 max-w-4xl mx-auto border-t border-white/[0.04]">
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold text-white tracking-tight">Built for Real-World Workflows</h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
          {[
            { title: 'Customer Support', desc: 'Tier 1 triage & troubleshooting' },
            { title: 'Healthcare Reception', desc: 'Bilingual patient booking' },
            { title: 'Education', desc: 'Spoken language tutoring' },
            { title: 'Recruitment', desc: 'Candidate prescreening' },
            { title: 'Lead Generation', desc: 'Inbound sales qualification' },
          ].map((u) => (
            <div key={u.title} className="p-4 rounded-xl bg-[#121215]">
              <span className="font-medium text-white block mb-0.5">{u.title}</span>
              <span className="text-[11px] text-zinc-500">{u.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Halftone Wordmark Interactive Footer */}
      <HalftoneWordmarkFooter
        wordmark="vaani"
        label="VAANI AI"
        meta="©2026 · Conversational Voice Studio · ElevenLabs Partner"
        preset="night"
        palette={{ background: "#121215" }}
        height="560px"
        columns={[
          {
            title: "Platform",
            links: [
              { label: "Voice Studio", href: "/dashboard" },
              { label: "Create Agent", href: "/dashboard/agents/new" },
              { label: "Voice Library", href: "/dashboard/voices" },
              { label: "Knowledge Base", href: "/dashboard/knowledge" },
            ],
          },
          {
            title: "Capabilities",
            links: [
              { label: "ElevenLabs Mesh", href: "#features" },
              { label: "Realtime WebRTC", href: "#demo" },
              { label: "Multilingual TTS", href: "#use-cases" },
              { label: "Benchmarking", href: "#features" },
            ],
          },
          {
            title: "Navigation",
            links: [
              { label: "Features", href: "#features" },
              { label: "Interactive Demo", href: "#demo" },
              { label: "Use Cases", href: "#use-cases" },
            ],
          },
        ]}
      />
    </div>
  );
}
