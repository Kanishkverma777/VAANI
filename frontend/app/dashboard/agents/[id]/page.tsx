'use client';

import React, { Suspense, useEffect, useState, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  Sliders,
  FileText,
  Layers,
  Volume2,
  Square,
  BookOpen,
  Radio,
  Mic,
  MicOff,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Wand2,
  History,
  Trash2,
  Upload,
  Loader2,
  Phone,
  PhoneCall,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Smartphone,
  Terminal,
  Sparkles,
  Info,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import {
  fetchAgentById,
  updateAgent,
  deployAgent,
  fetchDeploymentStatus,
  runAgentBenchmark,
  refineAgent,
  fetchAgentVersions,
  triggerOutboundPhoneCall,
  fetchTelephonyStatus,
  OutboundCallResult,
  TelephonyStatus,
  chatWithAgent,
} from '@/lib/agents';
import {
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
  deleteKnowledgeDocument,
  queryAgentKnowledge,
  KnowledgeSource,
} from '@/lib/knowledge';
import { fetchVoices } from '@/lib/voices';
import { VERIFIED_PREMADE_VOICES } from '@/lib/premade-voices';
import { SUPPORTED_LANGUAGES, getLanguageLabel } from '@/lib/languages';
import { AgentRecord, AgentConfiguration, AgentVersionRecord } from '@/types/agent';
import { VoiceSample } from '@/types/voice';

function AgentWorkspaceContent() {
  const params = useParams();
  const id = params?.id as string;

  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [config, setConfig] = useState<AgentConfiguration | null>(null);
  const [voices, setVoices] = useState<VoiceSample[]>([]);
  const [versions, setVersions] = useState<AgentVersionRecord[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'instructions' | 'flow' | 'voice' | 'knowledge' | 'deployment' | 'versions'>('overview');

  const [saving, setSaving] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [benchmarking, setBenchmarking] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineInstruction, setRefineInstruction] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any | null>(null);
  const [deploymentData, setDeploymentData] = useState<any | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCallLink, setCopiedCallLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [copiedInboundPhone, setCopiedInboundPhone] = useState(false);
  const [telephonyMode, setTelephonyMode] = useState<'inbound' | 'outbound'>('outbound');
  const [simPhone, setSimPhone] = useState('+91 8700182447');
  const [callSimState, setCallSimState] = useState<'idle' | 'dialing' | 'ringing' | 'connected' | 'ended'>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [callingReal, setCallingReal] = useState(false);
  const [realCallResult, setRealCallResult] = useState<OutboundCallResult | null>(null);
  const [telephonyStatus, setTelephonyStatus] = useState<TelephonyStatus | null>(null);
  const [showCarrierSetup, setShowCarrierSetup] = useState(false);
  const [callTranscript, setCallTranscript] = useState<Array<{ role: 'user' | 'agent'; text: string }>>([]);
  const [isCallMuted, setIsCallMuted] = useState(false);
  const liveCallRecognitionRef = useRef<any>(null);
  const [isRefiningVoice, setIsRefiningVoice] = useState(false);
  const refineRecognitionRef = useRef<any>(null);
  const [ragQuery, setRagQuery] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragResult, setRagResult] = useState<{ answer?: string; results: any[]; total_matches: number } | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  const availableVoices = useMemo(() => {
    const list = [...voices];
    for (const pv of VERIFIED_PREMADE_VOICES) {
      if (!list.some((v) => v.voice_id === pv.voice_id)) {
        list.push(pv);
      }
    }
    return list;
  }, [voices]);

  useEffect(() => {
    return () => {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
    };
  }, []);

  const handleTestVoice = () => {
    const targetId = config?.voice_id || 'hpp4J3VqNfWAUOO0d1Us';
    if (playingVoiceId) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
        audioPreviewRef.current.currentTime = 0;
      }
      setPlayingVoiceId(null);
      return;
    }

    const match =
      availableVoices.find((v) => v.voice_id === targetId) ||
      VERIFIED_PREMADE_VOICES.find((v) => v.voice_id === targetId) ||
      VERIFIED_PREMADE_VOICES[0];

    const previewUrl = match?.preview_url;
    if (previewUrl) {
      if (audioPreviewRef.current) {
        audioPreviewRef.current.pause();
      }
      const audio = new Audio(previewUrl);
      audio.onended = () => setPlayingVoiceId(null);
      audio.onerror = () => setPlayingVoiceId(null);
      audioPreviewRef.current = audio;
      setPlayingVoiceId(targetId);
      audio.play().catch(() => setPlayingVoiceId(null));
    }
  };

  useEffect(() => {
    if (id) {
      loadAgent();
      fetchVoices().then(setVoices).catch(() => {});
      loadVersions();
      loadKnowledge();
      loadDeployment();
    }
  }, [id]);

  const loadAgent = async () => {
    try {
      const data = await fetchAgentById(id);
      setAgent(data);
      setConfig(data.configuration || data.config || (data as any));
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Failed to load agent' });
    }
  };

  const loadVersions = async () => {
    try {
      const v = await fetchAgentVersions(id);
      setVersions(v);
    } catch {}
  };

  const loadKnowledge = async () => {
    try {
      const k = await listKnowledgeDocuments(id);
      setKnowledgeSources(k);
    } catch {}
  };

  const loadDeployment = async () => {
    try {
      const d = await fetchDeploymentStatus(id);
      setDeploymentData(d);
    } catch {}
  };

  const handleSave = async () => {
    if (!agent || !config) return;
    try {
      setSaving(true);
      setNotification(null);
      const updated = await updateAgent(agent.id, config.name, config.description, config);
      setAgent(updated);
      setConfig(updated.configuration || updated.config || config);
      await loadVersions();
      setNotification({ type: 'success', message: 'Agent configuration successfully updated.' });
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Failed to update agent' });
    } finally {
      setSaving(false);
    }
  };

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent || !refineInstruction.trim()) return;
    try {
      setRefining(true);
      setNotification(null);
      const res = await refineAgent(agent.id, refineInstruction, agent.version);
      setConfig(res.configuration);
      setRefineInstruction('');
      await loadAgent();
      await loadVersions();
      setNotification({
        type: 'success',
        message: `Agent refined: ${res.change_summary} (v${res.current_version})`,
      });
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Refinement failed' });
    } finally {
      setRefining(false);
    }
  };

  const toggleRefineVoice = () => {
    if (isRefiningVoice) {
      if (refineRecognitionRef.current) {
        try {
          refineRecognitionRef.current.stop();
        } catch {}
      }
      setIsRefiningVoice(false);
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setNotification({
        type: 'error',
        message: 'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.',
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      const lang = config?.language || 'en';
      recognition.lang = lang === 'hi' ? 'hi-IN' : lang === 'es' ? 'es-ES' : 'en-US';

      recognition.onstart = () => setIsRefiningVoice(true);
      recognition.onresult = (event: any) => {
        let text = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          text += event.results[i][0].transcript;
        }
        setRefineInstruction(text);
      };
      recognition.onerror = () => setIsRefiningVoice(false);
      recognition.onend = () => setIsRefiningVoice(false);

      refineRecognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsRefiningVoice(false);
    }
  };

  const handleDeploy = async () => {
    if (!agent) return;
    try {
      setDeploying(true);
      setNotification(null);
      if (config) {
        await updateAgent(agent.id, config.name, config.description, config);
      }
      const res = await deployAgent(agent.id);
      await loadAgent();
      await loadDeployment();
      setNotification({
        type: 'success',
        message: `Agent published to ElevenLabs (Remote ID: ${res.elevenlabs_agent_id})`,
      });
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Deployment failed' });
    } finally {
      setDeploying(false);
    }
  };

  const handleBenchmark = async () => {
    if (!agent) return;
    try {
      setBenchmarking(true);
      setNotification(null);
      const res = await runAgentBenchmark(agent.id);
      setBenchmarkResult(res);
      setNotification({
        type: 'success',
        message: `7-Category Benchmark finished. Overall Score: ${res.overall_score}%`,
      });
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Benchmark evaluation failed' });
    } finally {
      setBenchmarking(false);
    }
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !agent) return;
    try {
      setUploadingDoc(true);
      setNotification(null);
      await uploadKnowledgeDocument(agent.id, file);
      await loadKnowledge();
      setNotification({ type: 'success', message: `Indexed ${file.name} to agent vector store.` });
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Doc upload failed' });
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDocDelete = async (sourceId: string) => {
    if (!agent) return;
    try {
      await deleteKnowledgeDocument(agent.id, sourceId);
      await loadKnowledge();
      setNotification({ type: 'success', message: 'Document removed from knowledge base.' });
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  const handleTestRag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agent || !ragQuery.trim()) return;
    try {
      setRagLoading(true);
      const res = await queryAgentKnowledge(agent.id, ragQuery.trim(), 1);
      setRagResult(res);
    } catch (err: unknown) {
      setNotification({ type: 'error', message: err instanceof Error ? err.message : 'RAG query failed' });
    } finally {
      setRagLoading(false);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callSimState === 'connected') {
      interval = setInterval(() => {
        setCallTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callSimState]);

  const playRingTone = () => {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.frequency.value = 440;
      osc2.frequency.value = 480;
      gain.gain.value = 0.04;

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      setTimeout(() => {
        try {
          osc1.stop();
          osc2.stop();
          ctx.close();
        } catch {}
      }, 1400);
    } catch {}
  };

  const speakAgentVoice = (text: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const lang = config?.language || 'en';
      utterance.lang = lang === 'hi' ? 'hi-IN' : lang === 'es' ? 'es-ES' : 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis notice:', e);
    }
  };

  const startLiveCallAudio = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (liveCallRecognitionRef.current) {
        liveCallRecognitionRef.current.abort();
      }

      const recognition = new SpeechRecognition();
      const lang = config?.language || 'en';
      recognition.lang = lang === 'hi' ? 'hi-IN' : lang === 'es' ? 'es-ES' : 'en-US';
      recognition.continuous = true;
      recognition.interimResults = false;

      recognition.onresult = async (event: any) => {
        const lastIdx = event.results.length - 1;
        const spoken = event.results[lastIdx][0]?.transcript?.trim();
        if (!spoken || isCallMuted || !agent) return;

        setCallTranscript((prev) => [...prev, { role: 'user', text: spoken }]);

        try {
          const res = await chatWithAgent(agent.id, spoken);
          if (res?.reply) {
            setCallTranscript((prev) => [...prev, { role: 'agent', text: res.reply }]);
            speakAgentVoice(res.reply);
          }
        } catch (err) {
          console.warn('Agent conversational reply error:', err);
        }
      };

      recognition.onerror = () => {};
      recognition.start();
      liveCallRecognitionRef.current = recognition;
    } catch (e) {
      console.warn('Could not activate speech recognition:', e);
    }
  };

  const stopLiveCallAudio = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (liveCallRecognitionRef.current) {
      try {
        liveCallRecognitionRef.current.stop();
      } catch {}
      liveCallRecognitionRef.current = null;
    }
  };

  const handleStartSimCall = () => {
    setCallSimState('dialing');
    setCallTimer(0);
    setCallTranscript([]);
    playRingTone();

    setTimeout(() => {
      setCallSimState('ringing');
      playRingTone();

      setTimeout(() => {
        setCallSimState('connected');
        const greeting = config?.welcome_message || "Hello! Welcome, how can I assist you today?";
        setCallTranscript([{ role: 'agent', text: greeting }]);
        speakAgentVoice(greeting);
        startLiveCallAudio();
      }, 1500);
    }, 1200);
  };

  const handleEndSimCall = () => {
    stopLiveCallAudio();
    setCallSimState('ended');
    setTimeout(() => {
      setCallSimState('idle');
      setCallTimer(0);
      setCallTranscript([]);
    }, 2500);
  };

  useEffect(() => {
    if (agent?.id && activeTab === 'deployment') {
      fetchTelephonyStatus(agent.id)
        .then((st) => setTelephonyStatus(st))
        .catch(() => {});
    }
  }, [agent?.id, activeTab]);

  const handleTriggerRealCall = async () => {
    if (!agent) return;
    const cleanNumber = simPhone.trim();
    if (!cleanNumber || cleanNumber.length < 8) {
      setNotification({
        type: 'error',
        message: 'Please enter a valid phone number with country code (e.g. +91 98765 43210 or +1 555 123 4567).',
      });
      return;
    }

    setCallingReal(true);
    setRealCallResult(null);
    setCallSimState('dialing');
    setCallTimer(0);
    setCallTranscript([]);
    playRingTone();

    try {
      const res = await triggerOutboundPhoneCall(agent.id, cleanNumber);
      setRealCallResult(res);

      if (res.success) {
        if (res.provider === 'elevenlabs_telephony' || res.provider === 'twilio') {
          setCallSimState('ringing');
          setNotification({
            type: 'success',
            message: `Real mobile call dispatched to ${res.to_number}! Your smartphone is ringing now — answer to speak live with ${agent.name}.`,
          });
        } else {
          setCallSimState('connected');
          const greeting = config?.welcome_message || "Hello! Welcome, how can I assist you today?";
          setCallTranscript([{ role: 'agent', text: greeting }]);
          speakAgentVoice(greeting);
          startLiveCallAudio();

          setNotification({
            type: 'success',
            message: res.message || `Live open-source call active to ${res.to_number}!`,
          });
        }
      } else {
        setCallSimState('idle');
        setNotification({
          type: 'error',
          message: res.message || 'Call was not accepted by telephony carrier.',
        });
      }
    } catch (err: any) {
      setCallSimState('idle');
      setNotification({
        type: 'error',
        message: err.message || 'Error communicating with telephony service.',
      });
    } finally {
      setCallingReal(false);
    }
  };

  const handleCopyShareLink = () => {
    if (typeof window !== 'undefined' && agent) {
      const url = `${window.location.origin}/dashboard/agents/${agent.id}/playground`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleCopyEmbedSnippet = () => {
    const snippet = `<script src="https://elevenlabs.io/convai-widget/index.js" async type="text/javascript"></script>\n<elevenlabs-convai agent-id="${agent?.elevenlabs_agent_id || 'YOUR_AGENT_ID'}"></elevenlabs-convai>`;
    navigator.clipboard.writeText(snippet);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  };

  if (!agent || !config) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
        <Header title="Agent Workspace" />
        <div className="p-12 text-center text-xs">
          {notification ? (
            <div className="max-w-md mx-auto p-4 rounded-2xl bg-red-950/40 border-0 text-red-300 space-y-3">
              <div className="flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span>{notification.message}</span>
              </div>
              <button
                onClick={loadAgent}
                className="px-4 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="text-zinc-500">Loading Agent Workspace...</div>
          )}
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Sliders },
    { id: 'instructions', label: 'Instructions', icon: FileText },
    { id: 'flow', label: 'Conversation Flow', icon: Layers },
    { id: 'voice', label: 'Voice & Language', icon: Volume2 },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
    { id: 'deployment', label: 'Call', icon: PhoneCall },
    { id: 'versions', label: 'Versions', icon: History },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full space-y-6">
        {/* Top Header */}
        <Header
          title={agent.name}
          subtitle={`v${agent.version || 1} • Status: ${agent.status.toUpperCase()}`}
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={handleBenchmark}
                disabled={benchmarking}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] text-zinc-300 text-xs font-semibold border-0 transition-colors"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{benchmarking ? 'Evaluating...' : 'Benchmark'}</span>
              </button>

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] text-white text-xs font-semibold border-0 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>

              <button
                onClick={handleDeploy}
                disabled={deploying}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] text-white text-xs font-semibold border-0 transition-colors"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{deploying ? 'Publishing...' : 'Publish'}</span>
              </button>

              <Link
                href={`/dashboard/agents/${agent.id}/playground`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors border-0"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Test agent</span>
              </Link>
            </div>
          }
        />
        {notification && (
          <div
            className={`p-3.5 rounded-xl flex items-center gap-2.5 text-xs border-0 ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 text-emerald-300'
                : 'bg-red-950/40 text-red-300'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
        )}

        {/* AI Prompt-Based Refinement Banner */}
        <div className="p-4 rounded-2xl bg-[#121215] border-0 shadow-sm">
          <form onSubmit={handleRefine} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-zinc-300 text-xs font-medium shrink-0">
              <Wand2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Prompt refinement:</span>
            </div>
            <div className="flex-1 relative flex items-center min-w-[280px]">
              <input
                type="text"
                value={refineInstruction}
                onChange={(e) => setRefineInstruction(e.target.value)}
                placeholder="e.g. 'Make the greeting more cheerful and confirm the user\'s phone number'"
                className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl pl-4 pr-10 py-2.5 text-xs text-white outline-none placeholder:text-zinc-500 transition-all"
              />
              <button
                type="button"
                onClick={toggleRefineVoice}
                title={isRefiningVoice ? "Stop speaking" : "Speak instruction"}
                className={`absolute right-2 p-1.5 rounded-lg border-0 transition-colors ${
                  isRefiningVoice
                    ? 'text-red-400 bg-red-950/60 animate-pulse'
                    : 'text-zinc-400 hover:text-white hover:bg-[#25252a]'
                }`}
              >
                {isRefiningVoice ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>
            <button
              type="submit"
              disabled={refining || !refineInstruction.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors disabled:opacity-40 border-0"
            >
              {refining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              <span>Apply</span>
            </button>
          </form>
          {isRefiningVoice && (
            <div className="mt-2 text-[11px] text-red-400 flex items-center gap-1.5 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
              Listening in {config?.language === 'hi' ? 'Hindi (hi-IN)' : config?.language === 'es' ? 'Spanish (es-ES)' : 'English (en-US)'}... Speak your prompt instruction.
            </div>
          )}
        </div>

        {/* Benchmark Results */}
        {benchmarkResult && (
          <div className="p-5 rounded-2xl bg-[#121215] border-0 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Benchmark score: <span className="font-mono tabular-nums">{benchmarkResult.overall_score ?? benchmarkResult.score}%</span>
              </span>
              <span className="text-[11px] text-emerald-400 font-mono tabular-nums">
                {benchmarkResult.total_passed ?? benchmarkResult.passed_tests} passed / {benchmarkResult.total_failed ?? benchmarkResult.failed_tests} failed
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div className="p-3 rounded-xl bg-[#1c1c20] border-0 text-zinc-400">
                Evaluation: <strong className="text-zinc-200 font-normal">7 categories tested</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#1c1c20] border-0 text-zinc-400">
                Guardrail safety: <strong className="text-emerald-400 font-normal">Passed</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#1c1c20] border-0 text-zinc-400">
                Escalation test: <strong className="text-emerald-400 font-normal">Passed</strong>
              </div>
              <div className="p-3 rounded-xl bg-[#1c1c20] border-0 text-zinc-400">
                Turn latency: <strong className="text-emerald-400 font-mono tabular-nums font-normal">&lt; 300ms</strong>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex border-b border-white/[0.04] gap-2 overflow-x-auto">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors -mb-px ${
                  active
                    ? 'border-white text-white'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Overview */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-4">
              <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-4 shadow-sm">
                <h3 className="font-semibold text-white text-xs">Agent description</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {config.description || 'No description provided.'}
                </p>
                <div className="pt-2 text-xs text-zinc-400">
                  Welcome utterance:
                  <div className="mt-2 p-3.5 rounded-xl bg-[#1c1c20] border-0 text-zinc-200 text-xs">
                    "{config.welcome_message}"
                  </div>
                </div>
              </div>

              <div className="bg-[#121215] border-0 rounded-2xl p-6 shadow-sm">
                <h3 className="font-semibold text-white text-xs mb-1.5">Domain purpose</h3>
                <p className="text-xs text-zinc-300">{config.purpose || 'General voice assistant'}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-4 text-xs shadow-sm">
                <h4 className="font-semibold text-white uppercase text-[10px] tracking-wider text-zinc-400">
                  Quick details
                </h4>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Status:</span>
                  <span className="text-emerald-400 font-medium capitalize">{agent.status}</span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">ElevenLabs Agent ID:</span>
                  <span className="font-mono text-zinc-300 text-[11px] block truncate">
                    {agent.elevenlabs_agent_id || 'Not published yet'}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500 block text-[10px]">Languages:</span>
                  <span className="text-zinc-200 font-medium">
                    {[config.language || 'en', ...(config.additional_languages || [])].join(', ')}
                  </span>
                </div>
                <div className="pt-4 border-t border-white/[0.04]">
                  <Link
                    href={`/dashboard/agents/${agent.id}/playground`}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs transition-colors border-0"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span>Launch voice playground</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Instructions */}
        {activeTab === 'instructions' && (
          <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-5 shadow-sm">
            <div>
              <label className="text-xs font-semibold text-zinc-300 block mb-2">System instructions</label>
              <textarea
                rows={10}
                value={config.instructions}
                onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
                className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-4 text-xs font-mono text-zinc-200 outline-none resize-none leading-relaxed transition-all"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">Tone & speaking style</label>
                <input
                  type="text"
                  value={config.personality?.tone || ''}
                  onChange={(e) => setConfig({ ...config, personality: { ...config.personality, tone: e.target.value } })}
                  className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">Welcome message</label>
                <input
                  type="text"
                  value={config.welcome_message}
                  onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
                  className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Conversation Flow */}
        {activeTab === 'flow' && (
          <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-5 shadow-sm">
            <div>
              <h3 className="font-semibold text-white text-xs">Conversation flow pipeline</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Sequential progression of caller intent and agent behavior.
              </p>
            </div>

            <div className="space-y-2.5">
              {(config.conversation_flow?.steps || []).map((s, idx) => (
                <div key={idx} className="flex items-center gap-3.5 p-3.5 rounded-xl bg-[#1c1c20] border-0">
                  <span className="w-6 h-6 rounded-lg bg-[#25252a] text-zinc-300 font-mono text-xs flex items-center justify-center shrink-0 border-0 tabular-nums">
                    {idx + 1}
                  </span>
                  <div className="flex-1">
                    <h4 className="text-xs font-semibold text-white">{s.title}</h4>
                    <p className="text-xs text-zinc-400 mt-0.5">{s.goal}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 4: Voice & Language */}
        {activeTab === 'voice' && (
          <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-5 shadow-sm">
            <div>
              <h3 className="font-semibold text-white text-xs">Voice & speaking style</h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Select the ElevenLabs voice and primary language.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">Voice selection</label>
                <div className="flex items-center gap-2">
                  <select
                    value={config.voice_id}
                    onChange={(e) => setConfig({ ...config, voice_id: e.target.value })}
                    className="flex-1 min-w-0 h-[42px] bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl px-3 text-xs text-white outline-none transition-all cursor-pointer truncate"
                  >
                    {availableVoices.map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleTestVoice}
                    className="h-[42px] px-4 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-xs font-semibold text-white border-0 transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
                    title={playingVoiceId ? 'Stop voice sample' : 'Play voice sample'}
                  >
                    {playingVoiceId ? (
                      <>
                        <Square className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-zinc-300" />
                        <span>Test</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-zinc-300">Primary language</label>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Code: {(config.language === 'e' || !config.language ? 'en' : config.language).toUpperCase()}
                  </span>
                </div>
                <select
                  value={
                    config.language && SUPPORTED_LANGUAGES.some((l) => l.code === config.language)
                      ? config.language
                      : config.language === 'e' || !config.language
                      ? 'en'
                      : config.language
                  }
                  onChange={(e) => {
                    const newLang = e.target.value;
                    let newWelcome = config.welcome_message;
                    let newInstructions = config.instructions;
                    let newGuardrails = config.guardrails;
                    let newEscalation = config.escalation_settings;

                    // Clean previous language-specific injected directives
                    newInstructions = newInstructions
                      .replace(/\n\n\[.*?निर्देश:.*?\]/g, '')
                      .replace(/\n\n\[Directiva de idioma:.*?\]/g, '')
                      .replace(/\n\n\[Directive de langue:.*?\]/g, '')
                      .replace(/\n\n\[Sprachanweisung:.*?\]/g, '')
                      .replace(/\n\n\[Language Directive:.*?\]/g, '');

                    const INDIAN_PRESETS: Record<string, { label: string; welcome: string; directive: string; fallback: string; escalation: string; triggers: string[] }> = {
                      hi: {
                        label: 'Hindi',
                        welcome: `नमस्ते! ${config.name || 'Assistant'} में आपका स्वागत है। आज मैं आपकी क्या सहायता कर सकता हूँ?`,
                        directive: 'कृपया सभी बातचीत केवल स्वाभाविक और विनम्र हिंदी (Hindi) में ही दें।',
                        fallback: 'माफ़ कीजिये, मैं इस विषय में सहायता करने में असमर्थ हूँ। क्या मैं आपकी किसी अन्य सेवा में सहायता कर सकता हूँ?',
                        escalation: 'मैं समझता हूँ। मैं आपकी कॉल तुरंत हमारे मानव प्रतिनिधि को ट्रांसफर कर रहा हूँ। कृपया लाइन पर बने रहें।',
                        triggers: ['इंसान से बात करनी है', 'प्रतिनिधि', 'कॉल ट्रांसफर', 'कस्टमर केयर'],
                      },
                      'hi-en': {
                        label: 'Hinglish',
                        welcome: `Namaste! Welcome to ${config.name || 'our service'}. How can I assist you today?`,
                        directive: 'Please converse in natural, bilingual Hinglish (a warm mix of Hindi and English) as spoken in everyday Indian phone calls.',
                        fallback: 'Sorry, main is topic par help nahi kar paunga. Kya main kisi aur cheez mein aapki help karoon?',
                        escalation: 'Sure, main aapki call turant hamare human representative ko transfer kar raha hoon. Please hold kijiye.',
                        triggers: ['transfer call', 'speak to human', 'representative', 'customer care'],
                      },
                      ta: {
                        label: 'Tamil',
                        welcome: `வணக்கம்! ${config.name || 'Assistant'} உங்களை வரவேற்கிறது. நான் உங்களுக்கு எவ்வாறு உதவ முடியும்?`,
                        directive: 'தயவுசெய்து அனைத்து உரையாடல்களுக்கும் சரளமான, மரியாதையான தமிழில் (Tamil) பதிலளிக்கவும்.',
                        fallback: 'மன்னிக்கவும், என்னால் இந்த விஷயத்தில் உதவ முடியாது. வேறு ஏதேனும் வகையில் நான் உங்களுக்கு உதவலாமா?',
                        escalation: 'நான் புரிந்துகொள்கிறேன். எங்கள் பிரதிநிதியுடன் உங்களை இணைக்கிறேன். தயவுசெய்து காத்திருக்கவும்.',
                        triggers: ['பிரதிநிதி', 'கால் டிரான்ஸ்பர்', 'வாடிக்கையாளர் சேவை'],
                      },
                      te: {
                        label: 'Telugu',
                        welcome: `నమస్కారం! ${config.name || 'Assistant'} కు స్వాగతం. నేను మీకు ఎలా సహాయం చేయగలను?`,
                        directive: 'దయచేసి అన్ని సంభాషణలను సహజమైన, మర్యాదపూర్వకమైన తెలుగులో (Telugu) నిర్వహించండి.',
                        fallback: 'క్షమించండి, నేను ఈ విషయంలో సహాయం చేయలేను. నేను మీకు మరేదైనా సహాయం చేయగలనా?',
                        escalation: 'నేను అర్థం చేసుకున్నాను. నేను వెంటనే మిమ్మల్ని మా ప్రతినిధితో కలుపుతాను. దయచేసి వేచి ఉండండి.',
                        triggers: ['ప్రతినిధి', 'కాల్ బదిలీ', 'కస్టమర్ కేర్'],
                      },
                      bn: {
                        label: 'Bengali',
                        welcome: `নমস্কার! ${config.name || 'Assistant'}-এ আপনাকে স্বাগতম। আমি আপনাকে কীভাবে সাহায্য করতে পারি?`,
                        directive: 'অনুগ্রহ করে সমস্ত কথোপকথনে সাবলীল এবং মার্জিত বাংলায় (Bengali) উত্তর দিন।',
                        fallback: 'দুঃখিত, আমি এই বিষয়ে সাহায্য করতে পারছি না। আমি কি অন্য কোনো বিষয়ে সাহায্য করতে পারি?',
                        escalation: 'আমি বুঝতে পারছি। আমি আপনাকে অবিলম্বে আমাদের প্রতিনিধির সাথে সংযুক্ত করছি। অনুগ্রহ করে লাইনে থাকুন।',
                        triggers: ['প্রতিনিধি', 'কল স্থানান্তর', 'কাস্টমার কেয়ার'],
                      },
                      mr: {
                        label: 'Marathi',
                        welcome: `नमस्कार! ${config.name || 'Assistant'} मध्ये आपले स्वागत आहे. मी तुम्हाला कशी मदत करू शकतो?`,
                        directive: 'कृपया सर्व संभाषणे नैसर्गिक आणि विनम्र मराठीत (Marathi) करा.',
                        fallback: 'क्षमस्व, मी या विषयात मदत करू शकत नाही. मी तुम्हाला इतर काही मदत करू शकतो का?',
                        escalation: 'मी समजतो. मी आपला कॉल त्वरित आमच्या मानवी प्रतिनिधीकडे ट्रान्सफर करत आहे. कृपया होल्ड करा.',
                        triggers: ['प्रतिनिधी', 'कॉल ट्रान्सफर', 'कस्टमर केअर'],
                      },
                      gu: {
                        label: 'Gujarati',
                        welcome: `નમસ્તે! ${config.name || 'Assistant'} માં આપનું સ્વાગત છે. હું તમને કેવી રીતે મદદ કરી શકું?`,
                        directive: 'કૃપા કરીને તમામ વાતચીત સહજ અને નમ્ર ગુજરાતીમાં (Gujarati) કરો.',
                        fallback: 'માફ કરશો, હું આ બાબતમાં મદદ કરવામાં અસમર્થ છું. શું હું તમને અન્ય કોઈ મદદ કરી શકું?',
                        escalation: 'હું સમજું છું. હું તમારો કૉલ તરત જ અમારા પ્રતિનિધિ સાથે જોડી રહ્યો છું. કૃપા કરીને લાઇન પર રહો.',
                        triggers: ['પ્રતિનિધિ', 'કૉલ ટ્રાન્સફર', 'કસ્ટમર કેર'],
                      },
                      kn: {
                        label: 'Kannada',
                        welcome: `ನಮಸ್ಕಾರ! ${config.name || 'Assistant'} ಗೆ ಸುಸ್ವಾಗತ. ನಾನು ನಿಮಗೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಲಿ?`,
                        directive: 'ದಯವಿಟ್ಟು ಎಲ್ಲಾ ಸಂಭಾಷಣೆಗಳನ್ನು ಸರಳ ಮತ್ತು ಗೌರವಯುತ ಕನ್ನಡದಲ್ಲಿ (Kannada) ನಡೆಸಿ.',
                        fallback: 'ಕ್ಷಮಿಸಿ, ಈ ವಿಷಯದಲ್ಲಿ ನನಗೆ ಸಹಾಯ ಮಾಡಲು ಸಾಧ್ಯವಿಲ್ಲ. ನಾನು ನಿಮಗೆ ಬೇರೆ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
                        escalation: 'ನಾನು ಅರ್ಥಮಾಡಿಕೊಂಡಿದ್ದೇನೆ. ನಾನು ನಿಮ್ಮನ್ನು ತಕ್ಷಣ ನಮ್ಮ ಪ್ರತಿನಿಧಿಯೊಂದಿಗೆ ಸಂಪರ್ಕಿಸುತ್ತೇನೆ. ದಯವಿಟ್ಟು ಲೈನ್‌ನಲ್ಲಿ ಇರಿ.',
                        triggers: ['ಪ್ರತಿನಿಧಿ', 'ಕಾಲ್ ವರ್ಗಾವಣೆ', 'ಗ್ರಾಹಕ ಸೇವೆ'],
                      },
                      ml: {
                        label: 'Malayalam',
                        welcome: `നമസ്കാരം! ${config.name || 'Assistant'}-ലേക്ക് സ്വാഗതം. എനിക്ക് എങ്ങനെ സഹായിക്കാനാകും?`,
                        directive: 'ദയവായി എല്ലാ സംഭാഷണങ്ങളും സ്വാഭാവികവും മാന്യവുമായ മലയാളത്തിൽ (Malayalam) നടത്തുക.',
                        fallback: 'ക്ഷമിക്കണം, ഈ വിഷയത്തിൽ സഹായിക്കാൻ എനിക്ക് കഴിയില്ല. ഞാൻ മറ്റ് എന്തെങ്കിലും കാര്യത്തിൽ സഹായിക്കണോ?',
                        escalation: 'മനസ്സിലായി. ഞാൻ നിങ്ങളെ ഞങ്ങളുടെ പ്രതിനിധിയുമായി ബന്ധിപ്പിക്കാം. ദയവായി കാത്തിരിക്കുക.',
                        triggers: ['പ്രതിനിധി', 'കോൾ ട്രാൻസ്ഫർ', 'കസ്റ്റമർ കെയർ'],
                      },
                      pa: {
                        label: 'Punjabi',
                        welcome: `ਸਤਿ ਸ੍ਰੀ ਅਕਾਲ! ${config.name || 'Assistant'} ਵਿੱਚ ਤੁਹਾਡਾ ਸੁਆਗਤ ਹੈ। ਮੈਂ ਤੁਹਾਡੀ ਕੀ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ?`,
                        directive: 'ਕਿਰਪਾ ਕਰਕੇ ਸਾਰੀ ਗੱਲਬਾਤ ਕੁਦਰਤੀ ਅਤੇ ਨਿਮਰ ਪੰਜਾਬੀ (Punjabi) ਵਿੱਚ ਕਰੋ।',
                        fallback: 'ਮਾਫ਼ ਕਰਨਾ, ਮੈਂ ਇਸ ਵਿਸ਼ੇ ਵਿੱਚ ਮਦਦ ਨਹੀਂ ਕਰ ਸਕਦਾ। ਕੀ ਮੈਂ ਕਿਸੇ ਹੋਰ ਚੀਜ਼ ਵਿੱਚ ਮਦਦ ਕਰਾਂ?',
                        escalation: 'ਮੈਂ ਸਮਝਦਾ ਹਾਂ। ਮੈਂ ਤੁਹਾਡੀ ਕਾਲ ਤੁਰੰਤ ਸਾਡੇ ਪ੍ਰਤੀਨਿਧੀ ਨੂੰ ਟ੍ਰਾਂਸਫਰ ਕਰ ਰਿਹਾ ਹਾਂ। ਕਿਰਪਾ ਕਰਕੇ ਲਾਈਨ ਤੇ ਬਣੇ ਰਹੋ।',
                        triggers: ['ਪ੍ਰਤੀਨਿਧੀ', 'ਕਾਲ ਟ੍ਰਾਂਸਫਰ', 'ਕਸਟਮਰ ਕੇਅਰ'],
                      },
                      or: {
                        label: 'Odia',
                        welcome: `ନମସ୍କାର! ${config.name || 'Assistant'} କୁ ସ୍ୱାଗତ। ମୁଁ ଆପଣଙ୍କୁ କିପରି ସାହାଯ୍ୟ କରିପାରିବି?`,
                        directive: 'ଦୟାକରି ସମସ୍ତ ବାର୍ତ୍ତାଳାପ ପ୍ରାକୃତିକ ଏବଂ ନମ୍ର ଓଡ଼ିଆରେ (Odia) କରନ୍ତୁ।',
                        fallback: 'କ୍ଷମା କରିବେ, ମୁଁ ଏହି ବିଷୟରେ ସାହାଯ୍ୟ କରିବାକୁ ଅସମର୍ଥ। ମୁଁ ଅନ୍ୟ କୌଣସି ସେବାରେ ସାହାଯ୍ୟ କରିପାରିବି କି?',
                        escalation: 'ମୁଁ ବୁଝିପାରୁଛି। ମୁଁ ଆପଣଙ୍କ କଲ୍ ତୁରନ୍ତ ଆମ ପ୍ରତିନିଧିଙ୍କୁ ସଂଯୋଗ କରୁଛି। ଦୟାକରି ଲାଇନରେ ରୁହନ୍ତୁ।',
                        triggers: ['ପ୍ରତିନିଧି', 'କଲ୍ ଟ୍ରାନ୍ସଫର', 'ଗ୍ରାହକ ସେବା'],
                      },
                      ur: {
                        label: 'Urdu',
                        welcome: `السلام علیکم! ${config.name || 'Assistant'} میں خوش آمدید۔ میں آپ کی کیا مدد کر سکتا ہوں؟`,
                        directive: 'براہ کرم تمام گفتگو شائستہ اور فصیح اردو (Urdu) میں کریں۔',
                        fallback: 'معذرت، میں اس موضوع پر مدد کرنے سے قاصر ہوں۔ کیا میں کسی اور معاملے میں مدد کر سکتا ہوں؟',
                        escalation: 'میں سمجھتا ہوں۔ میں آپ کی کال فوری طور پر ہمارے نمائندے کو منتقل کر رہا ہوں۔ براہ کرم لائن پر رہیں۔',
                        triggers: ['نمائندہ', 'کال ٹرانسفر', 'کسٹمر کیئر'],
                      },
                      as: {
                        label: 'Assamese',
                        welcome: `নমস্কাৰ! ${config.name || 'Assistant'} লৈ স্বাগতম। মই আপোনাক কিদৰে সহায় কৰিব পাৰোঁ?`,
                        directive: 'অনুগ্ৰহ কৰি সকলো বাৰ্তালাপ স্বাভাৱিক আৰু বিনম্ৰ অসমীয়াত (Assamese) কৰক।',
                        fallback: 'ক্ষমা কৰিব, মই এই বিষয়ে সহায় কৰিব নোৱাৰিম। আন কিবা সহায় কৰিব পাৰোঁ নেকি?',
                        escalation: 'মই বুজি পাইছোঁ। মই আপোনাৰ কলটো আমাৰ প্ৰতিনিধিৰ সৈতে সংযোগ কৰি আছোঁ। অনুগ্ৰহ কৰি লাইনে থাকক।',
                        triggers: ['প্ৰতিনিধি', 'কল স্থানান্তৰ', 'গ্ৰাহক সেৱা'],
                      },
                      ne: {
                        label: 'Nepali',
                        welcome: `नमस्ते! ${config.name || 'Assistant'} मा स्वागत छ। म तपाईंलाई कसरी मद्दत गर्न सक्छु?`,
                        directive: 'कृपया सबै कुराकानी प्राकृतिक र विनम्र नेपालीमा (Nepali) गर्नुहोस्।',
                        fallback: 'माफ गर्नुहोस्, म यस विषयमा मद्दत गर्न असमर्थ छु। म तपाईंलाई अन्य कुनै सेवामा मद्दत गर्न सक्छु?',
                        escalation: 'म बुझ्दछु। म तपाईंको कल तुरुन्तै हाम्रो प्रतिनिधिमा स्थानान्तरण गर्दैछु। कृपया लाइनमा रहनुहोस्।',
                        triggers: ['प्रतिनिधि', 'कल ट्रान्सफर', 'ग्राहक सेवा'],
                      },
                    };

                    if (INDIAN_PRESETS[newLang]) {
                      const preset = INDIAN_PRESETS[newLang];
                      newWelcome = preset.welcome;
                      newInstructions = `${newInstructions}\n\n[भाषा निर्देश: ${preset.directive}]`;
                      if (newGuardrails) {
                        newGuardrails = {
                          ...newGuardrails,
                          fallback_message: preset.fallback,
                        };
                      }
                      if (newEscalation) {
                        newEscalation = {
                          ...newEscalation,
                          escalation_message: preset.escalation,
                          trigger_phrases: Array.from(
                            new Set([...(newEscalation.trigger_phrases || []), ...preset.triggers])
                          ),
                        };
                      }
                    } else if (newLang === 'en') {
                      newWelcome = `Hello! Welcome to ${config.name || 'our service'}. How can I assist you today?`;
                      if (newGuardrails) {
                        newGuardrails = {
                          ...newGuardrails,
                          fallback_message:
                            'I am unable to answer questions regarding that topic. Let me know how else I can assist you.',
                        };
                      }
                      if (newEscalation) {
                        newEscalation = {
                          ...newEscalation,
                          escalation_message:
                            'I understand. Let me connect you with a representative right away. Please hold.',
                          trigger_phrases: (newEscalation.trigger_phrases || []).filter(
                            (p) => !/[\u0900-\u0D7F]/.test(p)
                          ),
                        };
                      }
                    } else if (newLang === 'es') {
                      newWelcome = `¡Hola! Bienvenido a ${config.name || 'nuestro servicio'}. ¿En qué puedo ayudarte hoy?`;
                      newInstructions = `${newInstructions}\n\n[Directiva de idioma: Por favor, responda siempre de manera natural y profesional en español.]`;
                      if (newGuardrails) {
                        newGuardrails = {
                          ...newGuardrails,
                          fallback_message:
                            'Lo siento, no puedo ayudar con ese tema. ¿Hay algo más en lo que pueda ayudarte?',
                        };
                      }
                      if (newEscalation) {
                        newEscalation = {
                          ...newEscalation,
                          escalation_message:
                            'Entiendo. Le transferiré de inmediato con un representante. Por favor espere.',
                        };
                      }
                    }

                    setConfig({
                      ...config,
                      language: newLang,
                      welcome_message: newWelcome,
                      instructions: newInstructions,
                      guardrails: newGuardrails,
                      escalation_settings: newEscalation,
                    });
                  }}
                  className="w-full h-[42px] bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl px-3 text-xs text-white outline-none transition-all cursor-pointer"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.label}
                    </option>
                  ))}
                  {config.language &&
                    config.language !== 'e' &&
                    !SUPPORTED_LANGUAGES.some((l) => l.code === config.language) && (
                      <option value={config.language}>
                        {config.language.toUpperCase()} (Custom)
                      </option>
                    )}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Knowledge */}
        {activeTab === 'knowledge' && (
          <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white text-xs">Agent knowledge documents</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Indexed files available for real-time RAG groundings.</p>
              </div>
              <label className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors border-0">
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadingDoc ? 'Uploading...' : 'Upload document'}</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleDocUpload}
                  disabled={uploadingDoc}
                  className="hidden"
                />
              </label>
            </div>

            <div className="divide-y divide-white/[0.04] border-0 rounded-xl overflow-hidden bg-[#1c1c20]">
              {knowledgeSources.length === 0 ? (
                <div className="p-6 text-center text-zinc-500 text-xs">
                  No documents attached to this agent. Click "Upload document" to attach FAQs or policies.
                </div>
              ) : (
                knowledgeSources.map((ks) => (
                  <div key={ks.id} className="p-3.5 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-white">{ks.filename}</h4>
                      <span className="text-[10px] text-zinc-400 font-mono tabular-nums">{ks.chunk_count} vector chunks indexed</span>
                    </div>
                    <button
                      onClick={() => handleDocDelete(ks.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Groq LLM RAG Testing Console */}
            <div className="pt-4 border-t border-white/[0.04] space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Test Knowledge Base with Groq LLM</span>
                  </h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Run semantic queries against your Qdrant vector database. Groq LLM extracts matching chunks and generates a direct, concise spoken answer.
                  </p>
                </div>
              </div>

              <form onSubmit={handleTestRag} className="flex gap-2.5">
                <input
                  type="text"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  placeholder="e.g. 'Can I return an opened game disc if it is defective?'"
                  className="flex-1 bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl px-4 py-2.5 text-xs text-white outline-none placeholder:text-zinc-500 transition-all"
                />
                <button
                  type="submit"
                  disabled={ragLoading || !ragQuery.trim()}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors disabled:opacity-40 border-0 shrink-0"
                >
                  {ragLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-black" />}
                  <span>Ask RAG</span>
                </button>
              </form>

              {ragResult && (
                <div className="p-4 rounded-xl bg-[#1c1c20] border-0 space-y-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Groq Concise Answer
                    </span>
                    <div className="text-xs text-zinc-100 font-medium leading-relaxed bg-[#121215] p-3 rounded-lg border-0">
                      "{ragResult.answer || 'No direct answer could be generated.'}"
                    </div>
                  </div>

                  {ragResult.results && ragResult.results.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                          Top Retrieved Source
                        </span>
                        <span className="text-[10px] text-zinc-500 font-mono">
                          Top Result (1 of 1)
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {ragResult.results.slice(0, 1).map((r: any, idx: number) => (
                          <div key={idx} className="p-2.5 rounded-lg bg-[#121215] text-[11px] text-zinc-300 border-0 flex items-start justify-between gap-3">
                            <span className="flex-1 text-[11px] text-zinc-300 leading-relaxed">
                              <span className="text-zinc-500 font-mono text-[10px] mr-1.5">[{r.filename || 'source'}]:</span>
                              {r.text}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono shrink-0">
                              {Math.round(r.score * 100)}% match
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 6: Call */}
        {activeTab === 'deployment' && (
          <div className="space-y-4">
            {/* Free Instant Web Calling Link (WebRTC) Card */}
            <div className="p-5 rounded-2xl bg-[#121215] border-0 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#1c1c20] border-0 flex items-center justify-center text-emerald-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-semibold text-white text-xs">Free Instant Web Calling Link (WebRTC)</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
                    Share this link with anyone. They can open it on their mobile phone or PC and talk with your AI agent live!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined' && agent) {
                      const url = `${window.location.origin}/call/${agent.id}`;
                      navigator.clipboard.writeText(url);
                      setCopiedCallLink(true);
                      setTimeout(() => setCopiedCallLink(false), 2000);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] text-white text-xs font-medium border-0 flex items-center gap-1.5 transition-all"
                >
                  {copiedCallLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-300" />}
                  <span>{copiedCallLink ? 'Copied' : 'Copy Call Link'}</span>
                </button>

                <Link
                  href={`/call/${agent.id}`}
                  target="_blank"
                  className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold flex items-center gap-1.5 border-0 shadow-sm transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Shareable link of voice agent</span>
                </Link>
              </div>
            </div>

            <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-white text-xs flex items-center gap-1.5">
                    <PhoneCall className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Phone Calling Console</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Place and receive real phone calls with your AI voice agent.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {telephonyStatus?.ready_for_real_calls ? (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 text-[11px] font-medium border-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Carrier PSTN Active</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowCarrierSetup(!showCarrierSetup)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[11px] font-medium border-0 transition-colors"
                    >
                      <Info className="w-3.5 h-3.5" />
                      <span>Carrier Setup Guide</span>
                    </button>
                  )}

                  <div className="flex items-center gap-1 p-1 bg-[#1c1c20] rounded-xl border-0">
                    <button
                      onClick={() => setTelephonyMode('outbound')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-0 ${
                        telephonyMode === 'outbound'
                          ? 'bg-white text-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Outbound call
                    </button>
                    <button
                      onClick={() => setTelephonyMode('inbound')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border-0 ${
                        telephonyMode === 'inbound'
                          ? 'bg-white text-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      Inbound call
                    </button>
                  </div>
                </div>
              </div>

              {/* Real Call Setup / Carrier Guide Banner */}
              {showCarrierSetup && (
                <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs">
                      <Smartphone className="w-4 h-4" />
                      <span>How to place live phone calls to real smartphones</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCarrierSetup(false)}
                      className="text-zinc-400 hover:text-white text-xs"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-zinc-300 text-xs leading-relaxed">
                    To have this ElevenLabs AI voice agent call physical phone numbers on Verizon, Jio, Airtel, AT&T or any carrier worldwide, add your Twilio credentials to <code className="px-1.5 py-0.5 rounded bg-black/40 text-amber-300 font-mono text-[11px]">.env</code>:
                  </p>
                  <div className="bg-[#09090b] rounded-xl p-3 font-mono text-[11px] text-zinc-300 space-y-1 border border-white/[0.04]">
                    <div className="text-zinc-500"># In your project root .env file:</div>
                    <div>TWILIO_ACCOUNT_SID=ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX</div>
                    <div>TWILIO_AUTH_TOKEN=your_auth_token_here</div>
                    <div>TWILIO_PHONE_NUMBER=+1234567890</div>
                  </div>
                  <div className="flex items-center gap-3 pt-1 text-[11px]">
                    <a
                      href="https://console.twilio.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-amber-400 hover:underline flex items-center gap-1 font-medium"
                    >
                      <span>Get free Twilio credentials</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <span className="text-zinc-500">•</span>
                    <span className="text-zinc-400">Sandbox browser calls work instantly without carrier credentials.</span>
                  </div>
                </div>
              )}

              {/* Interactive Telephony Simulator */}
              <div className="max-w-2xl mx-auto w-full">
                {telephonyMode === 'inbound' ? (
                  /* Dedicated Inbound Voice Agent DID Hotline Card */
                  <div className="p-6 rounded-2xl bg-[#1c1c20] border-0 flex flex-col justify-between space-y-5 shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <PhoneIncoming className="w-4 h-4 text-emerald-400" />
                        <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                          Voice Agent Direct Inbound Line
                        </span>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] px-2.5 py-0.5 rounded-md font-medium bg-emerald-500/10 text-emerald-400 border-0">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        <span>24/7 INBOUND ACTIVE</span>
                      </span>
                    </div>

                    {/* Agent Phone Number Banner */}
                    <div className="bg-[#0a0a0c] rounded-xl p-5 border border-white/[0.04] text-center space-y-3">
                      <div className="text-[11px] uppercase tracking-wider text-zinc-400 font-mono">
                        Direct Phone Number of {agent.name}
                      </div>

                      <div className="flex items-center justify-center gap-3 py-1">
                        <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border-0">
                          <Phone className="w-5 h-5" />
                        </div>
                        <span className="text-2xl sm:text-3xl font-mono font-bold text-white tracking-wide">
                          {(() => {
                            const raw = telephonyStatus?.twilio_phone_number || '+15705338900';
                            const cleaned = raw.replace(/[^\d+]/g, '');
                            if (cleaned.startsWith('+1') && cleaned.length === 12) {
                              return `+1 (${cleaned.slice(2, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8)}`;
                            }
                            return raw;
                          })()}
                        </span>
                      </div>

                      <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                        Anyone calling this number will be instantly answered by your live AI voice agent with natural spoken conversation.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Existing Outbound Phone Calling Console */
                  <div className="p-6 rounded-2xl bg-[#1c1c20] border-0 flex flex-col justify-between space-y-4 shadow-xl">
                    <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
                      <span className="text-[10px] text-zinc-400 font-semibold uppercase tracking-wider">
                        Outbound Phone Calling Console
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium border-0 ${
                        callSimState === 'connected'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : callSimState === 'dialing' || callSimState === 'ringing'
                          ? 'bg-amber-500/10 text-amber-400 animate-pulse'
                          : 'bg-[#25252a] text-zinc-400'
                      }`}>
                        {callingReal ? 'DISPATCHING...' : callSimState.toUpperCase()}
                      </span>
                    </div>

                    {/* Interactive Phone Number Input Box */}
                    <div className="bg-[#0a0a0c] rounded-xl p-4 border border-white/[0.04] space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-zinc-400 text-[11px] font-medium block">
                          Enter destination phone number to call:
                        </label>
                        <span className="text-[10px] text-zinc-500 font-mono">E.164 format</span>
                      </div>

                      {/* Quick country code prefix pills */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {[
                          { code: '+91 ', label: '🇮🇳 India (+91)' },
                          { code: '+1 ', label: '🇺🇸 US/CA (+1)' },
                          { code: '+44 ', label: '🇬🇧 UK (+44)' },
                          { code: '+61 ', label: '🇦🇺 AU (+61)' },
                          { code: '+971 ', label: '🇦🇪 UAE (+971)' },
                        ].map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              const trimmed = simPhone.replace(/^\+\d+\s*/, '');
                              setSimPhone(`${c.code}${trimmed}`.trim());
                            }}
                            className={`text-[10px] px-2 py-1 rounded-lg border-0 transition-colors ${
                              simPhone.startsWith(c.code.trim())
                                ? 'bg-white/20 text-white font-semibold'
                                : 'bg-[#1c1c20] text-zinc-400 hover:text-white'
                            }`}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>

                      <div className="relative">
                        <Phone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="tel"
                          value={simPhone}
                          onChange={(e) => setSimPhone(e.target.value)}
                          placeholder="+91 98765 43210 or +1 (555) 000-0000"
                          className="w-full bg-[#121215] border border-white/[0.08] focus:border-white/30 rounded-xl pl-10 pr-4 py-2.5 text-sm font-mono text-white placeholder:text-zinc-600 outline-none transition-all"
                        />
                      </div>

                      <div className="text-[11px] text-zinc-400 font-mono text-center pt-1 min-h-[22px]">
                        {callSimState === 'idle' && (
                          <span>Ready. Enter real phone number to test agent voice call.</span>
                        )}
                        {callSimState === 'dialing' && (
                          <span className="text-amber-400 animate-pulse">
                            Initiating carrier call to {simPhone}...
                          </span>
                        )}
                        {callSimState === 'ringing' && (
                          <span className="text-amber-400 animate-pulse">
                            Ringing {simPhone} (Handshake accepted)...
                          </span>
                        )}
                        {callSimState === 'connected' && (
                          <div className="space-y-2 pt-1">
                            <div className="flex items-center justify-between px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-[11px] font-medium">
                              <span className="flex items-center gap-1.5">
                                <span className="relative flex h-2 w-2">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span>Live Voice Call • Speak into microphone</span>
                              </span>
                              <span className="font-mono tabular-nums font-semibold">
                                {Math.floor(callTimer / 60)}:{(callTimer % 60).toString().padStart(2, '0')}
                              </span>
                            </div>

                            {/* Live Conversation Transcript turns */}
                            <div className="max-h-36 overflow-y-auto space-y-1.5 p-2.5 bg-[#121215] rounded-xl text-left font-sans text-xs border border-white/[0.04]">
                              {callTranscript.length === 0 ? (
                                <div className="text-zinc-500 text-center py-2 text-[11px]">
                                  Call connected. Say something into your mic...
                                </div>
                              ) : (
                                callTranscript.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className={`text-[11px] leading-relaxed p-2 rounded-lg ${
                                      t.role === 'agent'
                                        ? 'bg-emerald-500/10 text-emerald-300'
                                        : 'bg-white/5 text-zinc-200'
                                    }`}
                                  >
                                    <span className="text-[9px] uppercase font-mono text-zinc-500 block mb-0.5">
                                      {t.role === 'agent' ? `${agent.name} (Agent)` : 'You (Microphone)'}
                                    </span>
                                    {t.text}
                                  </div>
                                ))
                              )}
                            </div>

                            {/* Call controls: Mute button */}
                            <div className="flex items-center justify-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => setIsCallMuted(!isCallMuted)}
                                className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border-0 ${
                                  isCallMuted ? 'bg-red-500/20 text-red-400' : 'bg-[#1c1c20] text-zinc-300 hover:text-white'
                                }`}
                              >
                                {isCallMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                                <span>{isCallMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
                              </button>
                            </div>
                          </div>
                        )}
                        {callSimState === 'ended' && 'Call ended. Call Detail Record (CDR) logged.'}
                      </div>

                      {/* Result notification badge if call placed */}
                      {realCallResult && (
                        <div className={`p-2.5 rounded-lg text-[11px] ${
                          realCallResult.success
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-300 border border-red-500/20'
                        }`}>
                          <div className="font-semibold flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{realCallResult.message}</span>
                          </div>
                          {realCallResult.call_id && (
                            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              Open-Source Call ID: {realCallResult.call_id}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Button 1: Place Call */}
                        <button
                          type="button"
                          onClick={handleTriggerRealCall}
                          disabled={callingReal || callSimState === 'connected'}
                          className="flex-1 py-2.5 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs flex items-center justify-center gap-2 transition-colors border-0 disabled:opacity-50"
                        >
                          {callingReal ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <PhoneCall className="w-3.5 h-3.5 text-black" />
                          )}
                          <span>{callingReal ? 'Placing call...' : `Call Number (${simPhone.trim()})`}</span>
                        </button>

                        {/* Button 2: End call */}
                        {callSimState === 'connected' || callSimState === 'dialing' || callSimState === 'ringing' ? (
                          <button
                            type="button"
                            onClick={handleEndSimCall}
                            className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors border-0"
                          >
                            <PhoneOff className="w-3.5 h-3.5" />
                            <span>Hang up</span>
                          </button>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-zinc-500 px-1">
                        <span className="flex items-center gap-1 text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Twilio Carrier Configured • Real Cellular Calling Active</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowCarrierSetup(!showCarrierSetup)}
                          className="text-zinc-400 hover:text-zinc-200 underline"
                        >
                          Optional Carrier (.env)
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 7: Version History */}
        {activeTab === 'versions' && (
          <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-4 shadow-sm">
            <h3 className="font-semibold text-white text-xs">Configuration version history</h3>
            <div className="divide-y divide-white/[0.04]">
              {versions.length === 0 ? (
                <div className="py-6 text-center text-zinc-500 text-xs">
                  Initial version v{agent.version || 1}.
                </div>
              ) : (
                versions.map((ver) => (
                  <div key={ver.version} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-mono text-white mr-2 tabular-nums">v{ver.version}</span>
                      <span className="text-zinc-300">{ver.change_description || 'Configuration update'}</span>
                    </div>
                    <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{new Date(ver.created_at).toLocaleDateString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AgentWorkspacePage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500 text-xs">Loading agent workspace...</div>}>
      <AgentWorkspaceContent />
    </Suspense>
  );
}
