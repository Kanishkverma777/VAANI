'use client';

import React, { Suspense, useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Script from 'next/script';
import {
  ShieldCheck,
  Check,
  Radio,
  Share2,
  AlertCircle,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import { fetchPublicAgent } from '@/lib/agents';
import { syncAgentSession } from '@/lib/conversations';
import { AgentRecord } from '@/types/agent';
import { getLanguageLabel } from '@/lib/languages';

// Persistent suppression of benign third-party ElevenLabs widget unmount/abort logs
if (typeof window !== 'undefined') {
  const orig = window.console.error;
  window.console.error = function (...args: any[]) {
    const firstArg = args[0];
    const msg = typeof firstArg === 'string' ? firstArg : (firstArg?.message || '');
    if (
      typeof msg === 'string' &&
      msg.includes('[ConversationalAI]') &&
      (msg.includes('aborted') || msg.includes('Fetch is aborted') || msg.includes('signal is aborted'))
    ) {
      return;
    }
    return orig.apply(this, args);
  };
}

function PublicWebCallContent() {
  const params = useParams();
  const agentId = params?.id as string;

  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);

  // Live Speech & Turns from ElevenLabs ConvAI
  const [transcripts, setTranscripts] = useState<Array<{ role: 'user' | 'agent'; text: string; time: string }>>([]);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);
  const latestConvIdRef = useRef<string | null>(null);
  const agentRef = useRef<AgentRecord | null>(null);

  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);

  // Auto-scroll transcript drawer
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Hook into live ElevenLabs ConvAI widget WebRTC events
  useEffect(() => {
    const handleConvaiCall = (event: Event) => {
      const customEvent = event as CustomEvent<{ config: any }>;
      const config = customEvent.detail?.config;
      if (!config) return;

      setIsCallActive(true);

      const originalOnConnect = config.onConnect;
      config.onConnect = (data: { conversationId?: string }) => {
        if (originalOnConnect) {
          try {
            originalOnConnect(data);
          } catch {}
        }
        if (data?.conversationId) {
          latestConvIdRef.current = data.conversationId;
          setIsCallActive(true);
        }
      };

      const originalOnMessage = config.onMessage;
      config.onMessage = (data: { source?: string; role?: string; message?: string }) => {
        if (originalOnMessage) {
          try {
            originalOnMessage(data);
          } catch {}
        }
        if (data?.message && typeof data.message === 'string') {
          const isUser = data.role === 'user' || data.source === 'user';
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setTranscripts((prev) => [
            ...prev,
            {
              role: isUser ? 'user' : 'agent',
              text: data.message || '',
              time: now,
            },
          ]);
        }
      };

      const originalOnDisconnect = config.onDisconnect;
      config.onDisconnect = (data: any) => {
        if (originalOnDisconnect) {
          try {
            originalOnDisconnect(data);
          } catch {}
        }
        setIsCallActive(false);

        const convId = latestConvIdRef.current;
        const currentAgent = agentRef.current;
        if (convId && currentAgent?.id) {
          setTimeout(() => {
            syncAgentSession(currentAgent.id, convId).catch(() => {});
          }, 1500);
        }
      };
    };

    window.addEventListener('elevenlabs-convai:call', handleConvaiCall);
    return () => {
      window.removeEventListener('elevenlabs-convai:call', handleConvaiCall);
    };
  }, []);

  // Fetch public agent details
  useEffect(() => {
    if (!agentId) return;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPublicAgent(agentId);
        setAgent(data);

        const cfg = data.configuration || data.config;
        const isHindi = cfg?.language === 'hi';
        const welcome =
          cfg?.welcome_message ||
          (isHindi
            ? `नमस्ते! मैं ${data.name} हूँ। बातचीत शुरू करने के लिए नीचे टैप करें।`
            : `Hello! I'm ${data.name}. Tap below to start our live voice conversation.`);

        setTranscripts([
          {
            role: 'agent',
            text: welcome,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch (err: any) {
        console.error('Failed to load agent:', err);
        setError(err.message || 'Voice Agent not found or unavailable.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [agentId]);

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center text-zinc-400 font-sans p-4">
        <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
          <Radio className="size-5 animate-pulse" />
        </div>
        <p className="text-xs font-medium text-zinc-300">Connecting to ElevenLabs Voice Engine...</p>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-[#050507] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="size-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
          <AlertCircle className="size-7" />
        </div>
        <h2 className="text-xl font-bold mb-2">Agent Unavailable</h2>
        <p className="text-xs text-zinc-400 max-w-sm mb-6">{error || 'This voice assistant could not be loaded.'}</p>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
        >
          Return to Platform
        </Link>
      </div>
    );
  }

  const activeElevenLabsId = agent.elevenlabs_agent_id || agent.provider_agent_id;
  const agentConfig = agent.configuration || agent.config;
  const language = agentConfig?.language || 'en';

  return (
    <div className="min-h-screen bg-[#050507] text-white font-sans flex flex-col justify-between selection:bg-emerald-500/30 selection:text-emerald-200 relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-emerald-500/10 via-cyan-500/5 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="relative z-10 w-full max-w-4xl mx-auto px-6 py-4 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-xl bg-white/10 flex items-center justify-center font-bold text-sm tracking-wider text-emerald-400">
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs tracking-tight text-white">VAANI</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/20 font-mono">
                ElevenLabs ConvAI
              </span>
            </div>
            <p className="text-[10px] text-zinc-500">Encrypted WebRTC Audio • Zero Phone Latency</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTranscript((prev) => !prev)}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium border border-white/5 transition-all"
            title="Toggle live dialogue transcript"
          >
            <MessageSquare className="size-3.5 text-zinc-400" />
            <span className="hidden sm:inline">{showTranscript ? 'Hide Subtitles' : 'Show Subtitles'}</span>
          </button>
          <button
            onClick={handleCopyLink}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium border border-white/5 transition-all"
            title="Share this call link with anyone"
          >
            {copiedLink ? <Check className="size-3.5 text-emerald-400" /> : <Share2 className="size-3.5 text-zinc-400" />}
            <span className="hidden sm:inline">{copiedLink ? 'Copied' : 'Share Call'}</span>
          </button>
        </div>
      </header>

      {/* Main Calling Stage */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 max-w-xl mx-auto w-full">
        {/* Agent Identity & Status */}
        <div className="text-center space-y-2 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400 backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{getLanguageLabel(language)}</span>
            <span className="text-zinc-600">•</span>
            <span className="capitalize">{agent.use_case ? agent.use_case.replace('_', ' ') : 'Customer Support'}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
            {agent.name}
          </h1>

          <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
            {agent.description || 'Speak naturally into your device microphone to chat live.'}
          </p>
        </div>

        {/* ElevenLabs Conversational AI WebRTC Hero Orb */}
        <div className="w-full flex items-center justify-center my-4 min-h-[320px]">
          {activeElevenLabsId ? (
            <div className="elevenlabs-inline-embed w-full flex items-center justify-center">
              <elevenlabs-convai
                key={`${activeElevenLabsId}-${language}-${agentConfig?.voice_id || ''}`}
                agent-id={activeElevenLabsId}
                variant="full"
                expandable="never"
                avatar-orb-color-1="#10B981"
                avatar-orb-color-2="#047857"
              ></elevenlabs-convai>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 text-zinc-400 py-16">
              <div className="size-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              <p className="text-xs">Provisioning ElevenLabs Voice Session...</p>
            </div>
          )}
        </div>

        {/* Live Conversation Transcript Drawer */}
        {showTranscript && (
          <div className="w-full max-w-md bg-[#0e0e12]/80 backdrop-blur-xl border border-white/10 rounded-2xl p-4 my-2 max-h-56 overflow-y-auto space-y-2 shadow-2xl transition-all">
            <div className="flex items-center justify-between pb-2 border-b border-white/5 text-[10px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3 text-emerald-400" />
                LIVE SPEECH TRANSCRIPT
              </span>
              <span className="text-emerald-400 font-sans font-medium text-[10px]">
                {isCallActive ? 'Call Connected' : 'Ready'}
              </span>
            </div>

            {transcripts.length === 0 ? (
              <div className="py-6 text-center text-xs text-zinc-500">
                Tap the microphone orb above to start speaking with {agent.name}...
              </div>
            ) : (
              transcripts.map((t, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl text-xs leading-relaxed ${
                    t.role === 'agent'
                      ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-200'
                      : 'bg-white/5 border border-white/5 text-zinc-200 ml-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[9px] text-zinc-400 font-mono mb-1">
                    <span className="font-semibold uppercase">
                      {t.role === 'agent' ? agent.name : 'You'}
                    </span>
                    {t.time && <span>{t.time}</span>}
                  </div>
                  <p>{t.text}</p>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>
        )}
      </main>

      {/* Bottom Footer Info */}
      <footer className="relative z-10 w-full max-w-4xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-zinc-500 border-t border-white/[0.04] gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="size-3.5 text-emerald-400" />
          <span>Encrypted WebRTC Audio Session • Powered 100% by ElevenLabs Conversational AI</span>
        </div>
        <div>
          Studio HD Neural Voice • <span className="text-zinc-300 font-semibold">VAANI AI</span>
        </div>
      </footer>
    </div>
  );
}

export default function PublicWebCallPage() {
  return (
    <>
      <Script
        src="https://elevenlabs.io/convai-widget/index.js"
        strategy="afterInteractive"
      />
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#050507] flex flex-col items-center justify-center text-zinc-400 font-sans p-4">
            <div className="size-12 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-3">
              <Radio className="size-5 animate-pulse" />
            </div>
            <p className="text-xs font-medium text-zinc-300">Connecting to Voice Agent...</p>
          </div>
        }
      >
        <PublicWebCallContent />
      </Suspense>
    </>
  );
}
