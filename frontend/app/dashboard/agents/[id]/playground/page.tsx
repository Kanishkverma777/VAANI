'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Script from 'next/script';
import {
  AlertCircle,
  RefreshCw,
  Sliders,
  Phone,
  PhoneCall,
  PhoneOff,
  Loader2,
  CheckCircle2,
  Info,
  ExternalLink,
  Smartphone,
  X,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  fetchAgentById,
  deployAgent,
  fetchAgentSessions,
  triggerOutboundPhoneCall,
  OutboundCallResult,
} from '@/lib/agents';
import { syncAgentSession } from '@/lib/conversations';
import { getLanguageLabel } from '@/lib/languages';
import { AgentRecord } from '@/types/agent';
import { TranscriptMessage } from '@/types/session';

// Persistent suppression of benign third-party ElevenLabs widget unmount/abort errors
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

function VoicePlaygroundContent() {
  const params = useParams();
  const id = params?.id as string;

  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isDeploying, setIsDeploying] = useState<boolean>(false);
  const [isSyncingTranscripts, setIsSyncingTranscripts] = useState<boolean>(false);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [hasValidWidget, setHasValidWidget] = useState<boolean>(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [showPhoneDialer, setShowPhoneDialer] = useState<boolean>(false);
  const [targetPhone, setTargetPhone] = useState<string>('+91 8700182447');
  const [callingCarrier, setCallingCarrier] = useState<boolean>(false);
  const [carrierCallResult, setCarrierCallResult] = useState<OutboundCallResult | null>(null);
  const [carrierSetupVisible, setCarrierSetupVisible] = useState<boolean>(false);
  const chatEndRef = React.useRef<HTMLDivElement | null>(null);
  const latestConvIdRef = React.useRef<string | null>(null);
  const agentRef = React.useRef<AgentRecord | null>(null);

  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);

  // Auto-scroll conversation feed as new speech messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  // Hook into live ElevenLabs ConvAI widget events to stream conversation in real-time
  useEffect(() => {
    const handleConvaiCall = (event: Event) => {
      const customEvent = event as CustomEvent<{ config: any }>;
      const config = customEvent.detail?.config;
      if (!config) return;

      setIsCallActive(true);

      // Track live session connection & conversation ID
      const originalOnConnect = config.onConnect;
      config.onConnect = (data: { conversationId?: string }) => {
        if (originalOnConnect) {
          try {
            originalOnConnect(data);
          } catch {}
        }
        if (data?.conversationId) {
          latestConvIdRef.current = data.conversationId;
          setActiveConversationId(data.conversationId);
          setIsCallActive(true);
        }
      };

      // Stream user speech & agent response in real time
      const originalOnMessage = config.onMessage;
      config.onMessage = (data: {
        source?: string;
        role?: string;
        message?: string;
      }) => {
        if (originalOnMessage) {
          try {
            originalOnMessage(data);
          } catch {}
        }

        if (data?.message && typeof data.message === 'string') {
          const isUser = data.role === 'user' || data.source === 'user';
          setTranscripts((prev) => {
            // Avoid duplicate identical consecutive welcome message if already showing
            if (
              !isUser &&
              prev.length === 1 &&
              prev[0].role === 'agent' &&
              prev[0].message.trim().toLowerCase() === data.message?.trim().toLowerCase()
            ) {
              return prev;
            }
            return [
              ...prev,
              {
                role: isUser ? 'user' : 'agent',
                message: data.message || '',
                timestamp: new Date().toISOString(),
              },
            ];
          });
        }
      };

      // Track disconnection & auto-persist conversation session to backend
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
            syncAgentSession(currentAgent.id, convId).catch((err) => {
              console.warn('Auto-sync session notice:', err);
            });
          }, 1500);
        }
      };
    };

    window.addEventListener('elevenlabs-convai:call', handleConvaiCall);
    return () => {
      window.removeEventListener('elevenlabs-convai:call', handleConvaiCall);
    };
  }, []);

  // Intercept Next.js devtools error handler (which hooks console.error during hydration)
  // to silence benign ElevenLabs widget abort logs on unmount/re-render.
  useEffect(() => {
    const devtoolsError = window.console.error;
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
      return devtoolsError.apply(this, args);
    };
    // Note: Do NOT restore devtoolsError on unmount, because ElevenLabs
    // triggers its abort cleanup during and after unmount.
  }, []);

  // Fetch agent and ensure valid ElevenLabs ConvAI provisioning
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    async function loadAgent() {
      try {
        setLoadError(null);
        const fetched = await fetchAgentById(id);
        if (!isMounted) return;

        let currentElevenLabsId =
          fetched.elevenlabs_agent_id || fetched.provider_agent_id;

        let isValid = false;

        // Verify if remote agent ID actually exists and has widget_config
        if (currentElevenLabsId) {
          try {
            const checkRes = await fetch(
              `https://api.elevenlabs.io/v1/convai/agents/${currentElevenLabsId}/widget`
            );
            if (checkRes.ok) {
              const widgetData = await checkRes.json();
              if (widgetData?.widget_config) {
                isValid = true;
              }
            }
          } catch {
            isValid = false;
          }
        }

        // If no remote ID or remote agent was deleted/expired/missing widget_config, auto-provision
        if (!currentElevenLabsId || !isValid) {
          setIsDeploying(true);
          try {
            const res = await deployAgent(fetched.id);
            if (isMounted && res.elevenlabs_agent_id) {
              currentElevenLabsId = res.elevenlabs_agent_id;
              fetched.elevenlabs_agent_id = res.elevenlabs_agent_id;
              fetched.provider_agent_id = res.elevenlabs_agent_id;
              fetched.status = 'active' as any;
              isValid = true;
            }
          } catch (deployErr: unknown) {
            console.warn('Auto-deploy warning:', deployErr);
          } finally {
            if (isMounted) setIsDeploying(false);
          }
        }

        if (isMounted) {
          setAgent(fetched);
          setHasValidWidget(isValid);

          const cfg = fetched.configuration || fetched.config;
          const isHindi = cfg?.language === 'hi';
          const welcome =
            cfg?.welcome_message ||
            (isHindi
              ? `नमस्ते! मैं ${fetched.name} हूँ। मुझसे बात करने के लिए 'Start a call' पर टैप करें।`
              : `Hello! I'm ${fetched.name}. Tap 'Start a call' to speak with me in real-time.`);
          setTranscripts([
            {
              role: 'agent',
              message: welcome,
              timestamp: new Date().toISOString(),
            },
          ]);
        }
      } catch (err: unknown) {
        if (isMounted) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load agent');
        }
      }
    }

    loadAgent();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleRedeploy = async () => {
    if (!agent) return;
    try {
      setIsDeploying(true);
      const res = await deployAgent(agent.id);
      const freshAgent = await fetchAgentById(agent.id);
      setAgent(freshAgent);
      setHasValidWidget(true);
    } catch (err: unknown) {
      console.error('Re-deploy failed:', err);
    } finally {
      setIsDeploying(false);
    }
  };

  const handlePlaceRealCall = async () => {
    if (!agent) return;
    const cleanNumber = targetPhone.trim();
    if (!cleanNumber || cleanNumber.length < 8) {
      alert('Please enter a valid phone number with country code (e.g. +91 98765 43210 or +1 555 123 4567).');
      return;
    }
    setCallingCarrier(true);
    setCarrierCallResult(null);
    try {
      const res = await triggerOutboundPhoneCall(agent.id, cleanNumber);
      setCarrierCallResult(res);
      if (res.requires_setup) {
        setCarrierSetupVisible(true);
      }
    } catch (err: any) {
      setCarrierCallResult({
        success: false,
        status: 'error',
        to_number: cleanNumber,
        provider: 'unknown',
        message: err.message || 'Failed to place real phone call',
      });
    } finally {
      setCallingCarrier(false);
    }
  };

  const handleSyncTranscripts = async () => {
    if (!agent) return;
    try {
      setIsSyncingTranscripts(true);

      // If we have an active ElevenLabs conversation ID, sync directly via backend API
      if (activeConversationId) {
        try {
          const synced = await syncAgentSession(agent.id, activeConversationId);
          if (synced?.transcript && synced.transcript.length > 0) {
            const mapped: TranscriptMessage[] = synced.transcript.map((turn: any) => ({
              role: turn.role === 'user' ? 'user' : 'agent',
              message: turn.message,
              timestamp: new Date().toISOString(),
            }));
            setTranscripts(mapped);
            return;
          }
        } catch (syncErr) {
          console.warn('Direct conversation sync notice:', syncErr);
        }
      }

      // Fallback: fetch historical agent sessions
      const sessions = await fetchAgentSessions(agent.id);
      if (sessions && sessions.length > 0) {
        const latestSession = sessions[0];
        if (latestSession.turns && latestSession.turns.length > 0) {
          const mapped: TranscriptMessage[] = latestSession.turns.map((turn: any) => ({
            role:
              turn.speaker === 'agent' || turn.role === 'agent' || turn.role === 'assistant'
                ? 'agent'
                : 'user',
            message: turn.text || turn.message || '',
            timestamp: turn.timestamp || new Date().toISOString(),
            latency_ms: turn.latency_ms,
          }));
          setTranscripts(mapped);
          return;
        }
      }
    } catch {
      // transcript sync fallback
    } finally {
      setIsSyncingTranscripts(false);
    }
  };

  if (!agent) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#09090B]">
        <Header title="Voice Playground" />
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500">
          {loadError ? (
            <div className="flex flex-col items-center gap-3 text-red-400">
              <AlertCircle className="w-6 h-6" />
              <p className="text-sm font-medium">{loadError}</p>
              <Link href="/dashboard/agents">
                <Button variant="outline" size="sm">
                  Return to Agents
                </Button>
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
              <p className="text-xs text-zinc-400">Connecting to Voice Pipeline...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const agentConfig = agent.configuration || agent.config;
  const activeElevenLabsId = agent.elevenlabs_agent_id || agent.provider_agent_id;
  const language = agentConfig?.language || 'en';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000] text-zinc-100">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full space-y-6">
        {/* Clean Minimal Top Navigation */}
        <Header
          title={agent.name}
          subtitle="Live conversational voice playground"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowPhoneDialer((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border-0 transition-colors ${
                  showPhoneDialer
                    ? 'bg-emerald-500 text-black'
                    : 'bg-[#1c1c20] hover:bg-[#25252b] text-white'
                }`}
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>{showPhoneDialer ? 'Hide Phone Dialer' : 'Call Real Phone'}</span>
              </button>
              <button
                type="button"
                onClick={handleRedeploy}
                disabled={isDeploying}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-xs font-semibold text-white border-0 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isDeploying ? 'animate-spin' : ''}`} />
                <span>{isDeploying ? 'Deploying...' : 'Re-deploy'}</span>
              </button>
              <Link href={`/dashboard/agents/${agent.id}`}>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-xs font-semibold text-white border-0 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Configure</span>
                </button>
              </Link>
            </div>
          }
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column (7 cols): Standalone Hero XL ElevenLabs AI Agent */}
          <div className="lg:col-span-7 flex flex-col justify-center items-center min-h-[500px]">
            <div className="elevenlabs-inline-embed w-full flex items-center justify-center">
              {activeElevenLabsId && hasValidWidget ? (
                <elevenlabs-convai
                  key={`${activeElevenLabsId}-${language}-${agentConfig?.voice_id || ''}`}
                  agent-id={activeElevenLabsId}
                  variant="full"
                  expandable="never"
                  avatar-orb-color-1="#10B981"
                  avatar-orb-color-2="#047857"
                ></elevenlabs-convai>
              ) : (
                <div className="flex flex-col items-center gap-3 text-zinc-400 py-16">
                  <div className="size-8 rounded-full border-2 border-emerald-500/20 border-t-emerald-400 animate-spin" />
                  <p className="text-xs">Connecting to ElevenLabs Voice Engine...</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column (5 cols): Agent Details & Transcript Stream */}
          <div className="lg:col-span-5 space-y-4">
            
            {/* Minimalist Agent Profile Card */}
            <div className="bg-[#121215] rounded-2xl p-6 shadow-sm border-0 space-y-4">
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-[#1c1c20] text-emerald-400 flex items-center justify-center font-bold text-xs border-0">
                    {agent.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">{agent.name}</h4>
                    <p className="text-[10px] text-zinc-400 capitalize mt-0.5">
                      {agentConfig?.use_case || 'Customer Support'} Assistant
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[#1c1c20] text-zinc-300 border-0">
                  {getLanguageLabel(language)}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#1c1c20] p-3 rounded-xl border-0">
                  <span className="text-[10px] text-zinc-500 block mb-0.5">Speaking Style</span>
                  <span className="text-zinc-200 font-medium text-[11px] truncate block">
                    {agentConfig?.personality?.tone || 'Natural & warm'}
                  </span>
                </div>
                <div className="bg-[#1c1c20] p-3 rounded-xl border-0">
                  <span className="text-[10px] text-zinc-500 block mb-0.5">Voice Engine</span>
                  <span className="text-emerald-400 font-mono text-[11px] block truncate">
                    ElevenLabs ConvAI
                  </span>
                </div>
              </div>
            </div>

            {/* Real Outbound Phone Call Dialing Console */}
            {showPhoneDialer && (
              <div className="bg-[#121215] rounded-2xl p-5 shadow-sm border border-white/[0.08] space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between pb-2.5 border-b border-white/[0.04]">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <h4 className="text-xs font-semibold text-white">Call Real Phone Number</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPhoneDialer(false)}
                    className="text-zinc-500 hover:text-zinc-300 text-xs p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] text-zinc-400 font-medium block">
                    Enter physical mobile/landline number:
                  </label>

                  {/* Country Prefix Pills */}
                  <div className="flex flex-wrap gap-1">
                    {[
                      { code: '+91 ', label: '🇮🇳 +91' },
                      { code: '+1 ', label: '🇺🇸 +1' },
                      { code: '+44 ', label: '🇬🇧 +44' },
                      { code: '+61 ', label: '🇦🇺 +61' },
                      { code: '+971 ', label: '🇦🇪 +971' },
                    ].map((c) => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => {
                          const num = targetPhone.replace(/^\+\d+\s*/, '');
                          setTargetPhone(`${c.code}${num}`.trim());
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-md border-0 transition-colors ${
                          targetPhone.startsWith(c.code.trim())
                            ? 'bg-white/20 text-white font-semibold'
                            : 'bg-[#1c1c20] text-zinc-400 hover:text-white'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>

                  <div className="relative">
                    <Phone className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="tel"
                      value={targetPhone}
                      onChange={(e) => setTargetPhone(e.target.value)}
                      placeholder="+91 98765 43210 or +1 (555) 000-0000"
                      className="w-full bg-[#1c1c20] border border-white/[0.08] focus:border-emerald-500/50 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-white placeholder:text-zinc-600 outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePlaceRealCall}
                  disabled={callingCarrier}
                  className="w-full py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center justify-center gap-2 transition-colors border-0 disabled:opacity-50"
                >
                  {callingCarrier ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <PhoneCall className="w-3.5 h-3.5 text-black" />
                  )}
                  <span>{callingCarrier ? 'Dispatching cellular call...' : 'Call Real Phone (+91 8700182447)'}</span>
                </button>

                {carrierCallResult && !carrierCallResult.success && (
                  <div className="p-3 rounded-xl text-xs space-y-1 bg-red-500/10 text-red-300 border border-red-500/20">
                    <div className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400" />
                      <span>{carrierCallResult.message}</span>
                    </div>
                  </div>
                )}

                {carrierSetupVisible && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] space-y-2">
                    <div className="text-amber-400 font-semibold flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" />
                      <span>Carrier Credentials Required (.env)</span>
                    </div>
                    <p className="text-zinc-300 text-[10px] leading-relaxed">
                      To receive phone calls on your smartphone, add Twilio credentials to <code className="px-1 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-[9px]">.env</code>:
                    </p>
                    <div className="p-2 bg-black/50 rounded text-[10px] font-mono text-zinc-300 select-all space-y-0.5">
                      <div>TWILIO_ACCOUNT_SID=AC...</div>
                      <div>TWILIO_AUTH_TOKEN=...</div>
                      <div>TWILIO_PHONE_NUMBER=+1...</div>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* Live Conversation Feed */}
            <div className="bg-[#121215] rounded-2xl p-6 shadow-sm border-0 flex flex-col h-[400px]">
              <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.04] shrink-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-white">Live Conversation</h4>
                  {isCallActive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border-0">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                      </span>
                      Live Connected
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {transcripts.length} turns
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSyncTranscripts}
                  disabled={isSyncingTranscripts}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1c1c20] hover:bg-[#25252b] text-[10px] font-medium text-zinc-300 transition-colors border-0"
                >
                  <RefreshCw className={`size-3 mr-0.5 ${isSyncingTranscripts ? 'animate-spin text-emerald-400' : ''}`} />
                  <span>Sync</span>
                </button>
              </div>

              {/* Speech Stream */}
              <div className="flex-1 overflow-y-auto space-y-3 py-3 pr-1 text-xs">
                {transcripts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500">
                    <p className="text-[11px]">No speech activity yet.</p>
                  </div>
                ) : (
                  transcripts.map((m, idx) => (
                    <div
                      key={idx}
                      className={`flex gap-2.5 ${m.role === 'agent' ? 'justify-start' : 'justify-end'} animate-in fade-in slide-in-from-bottom-2 duration-200`}
                    >
                      <div
                        className={`max-w-[85%] rounded-xl p-3.5 text-xs leading-relaxed shadow-sm border-0 ${
                          m.role === 'agent'
                            ? 'bg-[#1c1c20] text-zinc-200'
                            : 'bg-emerald-600/90 text-white font-normal'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1 text-[10px] opacity-80">
                          <span className="font-semibold">
                            {m.role === 'agent' ? agent.name : 'You'}
                          </span>
                          {m.latency_ms && (
                            <span className="text-[9px] font-mono text-emerald-300">
                              {m.latency_ms}ms
                            </span>
                          )}
                        </div>
                        <p>{m.message}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
            </div>

          </div>

        </div>
      </div>
    </div>
  );
}

export default function VoicePlaygroundPage() {
  return (
    <>
      <Script
        src="https://elevenlabs.io/convai-widget/index.js"
        strategy="afterInteractive"
      />
      <Suspense fallback={<div className="p-8 text-zinc-500 text-xs">Loading Voice Studio...</div>}>
        <VoicePlaygroundContent />
      </Suspense>
    </>
  );
}
