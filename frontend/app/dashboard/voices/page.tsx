'use client';

import React, { useEffect, useState } from 'react';
import { Volume2, Play, Pause, Search, Check, Sparkles, Filter, Plus, Upload, ShieldCheck, X, Loader2, AlertCircle, CheckCircle2, Download, Radio } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { fetchVoices, cloneVoice } from '@/lib/voices';
import { VoiceSample } from '@/types/voice';

const PRESET_SCENARIOS = [
  {
    label: '🏥 Clinic Appointment',
    text: 'Namaste! Main Tanu bol rahi hoon Apollo clinic se. Aapka doctor appointment kal dopahar 2 baje confirm ho gaya hai.',
  },
  {
    label: '💳 Banking & Payment',
    text: 'Namaste, aapka payment receive ho gaya hai. Transaction reference number 849201 aapke SMS par bhej diya gaya hai.',
  },
  {
    label: '📦 Order Delivery',
    text: 'Hello! Your package has been dispatched from the hub and will arrive at your address by 5 PM today.',
  },
  {
    label: '🎧 Customer Support',
    text: 'Namaste! VAANI Customer Support mein aapka swagat hai. Aaj main aapki kya madad kar sakti hoon?',
  },
];

export default function VoiceLibraryPage() {
  const [voices, setVoices] = useState<VoiceSample[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioObj, setAudioObj] = useState<HTMLAudioElement | null>(null);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null);

  // Voice cloning state
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [cloneName, setCloneName] = useState('');
  const [cloneDesc, setCloneDesc] = useState('');
  const [cloneConsent, setCloneConsent] = useState(false);
  const [cloneFile, setCloneFile] = useState<File | null>(null);
  const [isCloning, setIsCloning] = useState(false);
  const [cloneMessage, setCloneMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Interactive Voice Testing state
  const [testingVoice, setTestingVoice] = useState<VoiceSample | null>(null);
  const [customText, setCustomText] = useState(PRESET_SCENARIOS[0].text);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);
  const [isTestPlaying, setIsTestPlaying] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    fetchVoices()
      .then(setVoices)
      .catch(() => {});
  }, []);

  const handlePlayPreview = (voice: VoiceSample) => {
    if (playingVoiceId === voice.voice_id) {
      if (audioObj) audioObj.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioObj) {
      audioObj.pause();
    }

    const rawUrl = voice.preview_url || `/api/v1/voices/${voice.voice_id}/preview`;
    const resolvedUrl = rawUrl.startsWith('http')
      ? rawUrl
      : `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${rawUrl}`;

    const audio = new Audio(resolvedUrl);
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = (e) => {
      console.warn('Audio playback error:', e);
      setPlayingVoiceId(null);
    };
    audio.play().catch((err) => {
      console.warn('Audio play blocked or failed:', err);
      setPlayingVoiceId(null);
    });
    setAudioObj(audio);
    setPlayingVoiceId(voice.voice_id);
  };

  const handleSynthesizeCustomSpeech = async (voice: VoiceSample, textToSpeak: string) => {
    const trimmed = textToSpeak.trim();
    if (!trimmed) return;

    if (audioObj) {
      audioObj.pause();
      setPlayingVoiceId(null);
    }

    setIsSynthesizing(true);
    setTestError(null);

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const encoded = encodeURIComponent(trimmed);
      const url = `${apiBase}/api/v1/voices/${voice.voice_id}/preview?text=${encoded}`;

      const audio = new Audio(url);
      audio.onended = () => {
        setIsTestPlaying(false);
        setPlayingVoiceId(null);
      };
      audio.onerror = () => {
        setIsTestPlaying(false);
        setPlayingVoiceId(null);
        setTestError('Failed to play synthesized audio. Check backend connectivity.');
      };

      await audio.play();
      setTestAudioUrl(url);
      setAudioObj(audio);
      setIsTestPlaying(true);
      setPlayingVoiceId(voice.voice_id);
    } catch (err: unknown) {
      setTestError(err instanceof Error ? err.message : 'Neural speech generation failed.');
      setIsTestPlaying(false);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const toggleTestAudioPlayback = () => {
    if (!audioObj) return;
    if (isTestPlaying) {
      audioObj.pause();
      setIsTestPlaying(false);
    } else {
      audioObj.play().then(() => setIsTestPlaying(true)).catch(() => {});
    }
  };

  const handleCloneVoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloneName.trim() || !cloneFile) {
      setCloneMessage({ type: 'error', text: 'Please provide a voice name and audio sample.' });
      return;
    }
    if (!cloneConsent) {
      setCloneMessage({ type: 'error', text: 'You must confirm explicit consent before cloning a voice.' });
      return;
    }

    try {
      setIsCloning(true);
      setCloneMessage(null);
      const fd = new FormData();
      fd.append('name', cloneName.trim());
      fd.append('description', cloneDesc.trim() || 'Custom brand voice');
      fd.append('consent_verified', 'true');
      fd.append('file', cloneFile);

      const newVoice = await cloneVoice(fd);
      setVoices((prev) => [newVoice, ...prev]);
      setCloneMessage({ type: 'success', text: `Voice "${newVoice.name}" cloned successfully!` });
      setTimeout(() => {
        setShowCloneModal(false);
        setCloneName('');
        setCloneDesc('');
        setCloneFile(null);
        setCloneConsent(false);
        setCloneMessage(null);
        setSelectedCategory('cloned');
      }, 1500);
    } catch (err: unknown) {
      setCloneMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Voice cloning failed. Check ElevenLabs subscription or permissions.',
      });
    } finally {
      setIsCloning(false);
    }
  };

  const filteredVoices = voices.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.category && v.category.toLowerCase().includes(search.toLowerCase())) ||
      (v.accent && v.accent.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || v.category?.toLowerCase() === selectedCategory.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full space-y-6">
        <Header
          title="Voice library"
          subtitle="Browse and preview ElevenLabs hyper-realistic conversational voices with real-time neural synthesis."
          action={
            <button
              onClick={() => setShowCloneModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Clone brand voice</span>
            </button>
          }
        />
        {/* Search & Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#121215] shadow-sm border-0">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by voice name, accent, or style..."
              className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl pl-9 pr-3 py-2 text-xs text-white outline-none border-0 focus:ring-1 focus:ring-white/20 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-zinc-500 mr-1" />
            {['all', 'premade', 'cloned', 'generated'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
                  selectedCategory === cat
                    ? 'bg-white text-black font-semibold'
                    : 'bg-[#1c1c20] text-zinc-400 hover:text-white hover:bg-[#25252b]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Voice Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredVoices.map((voice) => {
            const isPlaying = playingVoiceId === voice.voice_id;
            const isSelected = selectedVoiceId === voice.voice_id;
            const isCloned = voice.category?.toLowerCase() === 'cloned';

            return (
              <div
                key={voice.voice_id}
                className={`p-5 rounded-2xl bg-[#121215] hover:bg-[#16161a] transition-all flex flex-col justify-between shadow-sm border-0 ${
                  isSelected ? 'ring-1 ring-white/30' : ''
                } ${isCloned ? 'border border-purple-500/20' : ''}`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        isCloned ? 'bg-purple-900/30 text-purple-300' : 'bg-[#1c1c20] text-zinc-300'
                      }`}>
                        {isCloned ? <Sparkles className="w-4 h-4 text-purple-300" /> : <Volume2 className="w-4 h-4 text-zinc-200" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-white text-xs truncate">{voice.name}</h3>
                          {isCloned && (
                            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/15 text-purple-300 border border-purple-500/30 text-[9px] font-semibold tracking-wide">
                              Cloned
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-zinc-500 capitalize">
                          {voice.category || 'Premade'} / {voice.gender || 'Neutral'}
                        </span>
                      </div>
                    </div>

                    {voice.accent && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#1c1c20] text-zinc-400 shrink-0">
                        {voice.accent}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-zinc-400 line-clamp-2 my-2.5 leading-relaxed">
                    {voice.description || 'Optimized for low-latency conversational speech synthesis.'}
                  </p>

                  <div className="text-[10px] font-mono text-zinc-400 bg-[#1c1c20] p-2 rounded-xl truncate tabular-nums">
                    ID: {voice.voice_id}
                  </div>
                </div>

                <div className="pt-3.5 border-t border-white/[0.04] flex items-center justify-between gap-2 mt-3.5">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handlePlayPreview(voice)}
                      disabled={!voice.preview_url}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                        isPlaying
                          ? 'bg-zinc-200 text-black font-semibold'
                          : 'bg-[#1c1c20] text-zinc-300 hover:bg-[#25252b] hover:text-white'
                      }`}
                      title="Play AI speech demonstration"
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? 'Pause' : 'Demo'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setTestingVoice(voice);
                        setCustomText(PRESET_SCENARIOS[0].text);
                        setTestError(null);
                        setTestAudioUrl(null);
                        setIsTestPlaying(false);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/25 transition-colors"
                      title="Test custom sentences with this voice"
                    >
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      <span>Test Speech</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setSelectedVoiceId(voice.voice_id)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                      isSelected
                        ? 'bg-[#1c1c20] text-white ring-1 ring-white/20'
                        : 'bg-white text-black hover:bg-zinc-200'
                    }`}
                  >
                    {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                    <span>{isSelected ? 'Selected' : 'Select'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Interactive Voice Testing Modal */}
      {testingVoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-[#121215] rounded-2xl p-6 space-y-5 shadow-2xl border border-white/10">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-purple-900/30 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-purple-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Test Voice: {testingVoice.name}</h3>
                    <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-mono">
                      {testingVoice.category || 'cloned'}
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Synthesize arbitrary new sentences in real-time to verify voice cloning & multi-use capability.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (audioObj) audioObj.pause();
                  setTestingVoice(null);
                  setIsTestPlaying(false);
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1c1c20] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Preset Selector */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-zinc-400">Quick Test Scenarios:</label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_SCENARIOS.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCustomText(p.text)}
                    className={`p-2.5 rounded-xl text-left text-xs transition-colors border ${
                      customText === p.text
                        ? 'bg-purple-950/40 border-purple-500/40 text-purple-200'
                        : 'bg-[#1c1c20] border-transparent text-zinc-300 hover:bg-[#232328]'
                    }`}
                  >
                    <div className="font-semibold text-[11px]">{p.label}</div>
                    <div className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{p.text}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Text Input Area */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-zinc-300">Custom Text to Speak (Hindi or English):</label>
                <span className="text-[10px] font-mono text-zinc-500">{customText.length} chars</span>
              </div>
              <textarea
                rows={3}
                value={customText}
                onChange={(e) => setCustomText(e.target.value)}
                placeholder="Type any sentence here to hear the cloned voice speak it..."
                className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl p-3 text-xs text-white outline-none border border-white/5 focus:border-purple-500/40 transition-colors resize-none"
              />
            </div>

            {testError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-200 text-xs">
                {testError}
              </div>
            )}

            {/* Audio Wave / Player Preview when available */}
            {testAudioUrl && (
              <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={toggleTestAudioPlayback}
                    className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center hover:bg-purple-600 transition-colors shadow-sm"
                  >
                    {isTestPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-white ml-0.5" />}
                  </button>
                  <div>
                    <div className="text-xs font-semibold text-purple-200 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                      <span>{isTestPlaying ? 'Playing synthetic speech...' : 'Speech synthesized successfully'}</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">
                      ElevenLabs Multilingual v2 • {testingVoice.name}
                    </span>
                  </div>
                </div>

                <a
                  href={testAudioUrl}
                  download={`cloned_voice_${testingVoice.name}.mp3`}
                  className="p-2 rounded-lg bg-[#1c1c20] hover:bg-[#25252b] text-zinc-300 hover:text-white transition-colors"
                  title="Download MP3 sample"
                >
                  <Download className="w-3.5 h-3.5" />
                </a>
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-white/[0.04]">
              <span className="text-[10px] text-zinc-500 font-mono">
                Engine: ElevenLabs Instant Voice Clone
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (audioObj) audioObj.pause();
                    setTestingVoice(null);
                    setIsTestPlaying(false);
                  }}
                  className="px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-white hover:bg-[#1c1c20] transition-colors"
                >
                  Close
                </button>
                <button
                  type="button"
                  disabled={isSynthesizing || !customText.trim()}
                  onClick={() => handleSynthesizeCustomSpeech(testingVoice, customText)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-md shadow-purple-900/30"
                >
                  {isSynthesizing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Speak with Cloned Voice</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Voice Cloning Modal */}
      {showCloneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#121215] rounded-2xl p-6 space-y-5 shadow-2xl border-0">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#1c1c20] text-zinc-300 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-zinc-200" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-white">Instant voice cloning</h3>
                  <p className="text-[10px] text-zinc-400">Clone a custom brand voice with ElevenLabs</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCloneModal(false);
                  setCloneMessage(null);
                }}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1c1c20] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {cloneMessage ? (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                  cloneMessage.type === 'success'
                    ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/20'
                    : 'bg-red-950/40 text-red-300 border border-red-500/20'
                }`}
              >
                {cloneMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{cloneMessage.text}</span>
              </div>
            ) : null}

            <form onSubmit={handleCloneVoice} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Voice name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Founder Voice, Priya CX"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl p-2.5 text-xs text-white outline-none border-0 focus:ring-1 focus:ring-white/20 transition-colors"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Description (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Warm, expressive, Indian English accent"
                  value={cloneDesc}
                  onChange={(e) => setCloneDesc(e.target.value)}
                  className="w-full bg-[#1c1c20] focus:bg-[#232328] rounded-xl p-2.5 text-xs text-white outline-none border-0 focus:ring-1 focus:ring-white/20 transition-colors"
                />
              </div>

              <div>
                <label className="block text-zinc-300 font-medium mb-1.5">Audio sample (.mp3, .wav) *</label>
                <div className="relative rounded-xl p-4 text-center cursor-pointer transition-colors bg-[#1c1c20] hover:bg-[#25252b]">
                  <input
                    type="file"
                    required
                    accept="audio/*"
                    onChange={(e) => setCloneFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-4 h-4 text-zinc-400 mx-auto mb-1.5" />
                  <span className="text-[11px] text-zinc-300 block font-medium">
                    {cloneFile ? cloneFile.name : 'Click or drag audio file here (1-2 mins speech)'}
                  </span>
                  <span className="text-[10px] text-zinc-500">MP3, WAV, or M4A up to 10MB</span>
                </div>
              </div>

              {/* Mandatory Consent Check */}
              <div className="p-3 rounded-xl bg-[#1c1c20] space-y-1">
                <label className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cloneConsent}
                    onChange={(e) => setCloneConsent(e.target.checked)}
                    className="mt-0.5 w-3.5 h-3.5 accent-white rounded cursor-pointer"
                  />
                  <div className="text-[11px] text-zinc-300 leading-snug">
                    <span className="font-medium text-white flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      Responsible AI & consent verification
                    </span>
                    I certify that I have explicit written authorization from the speaker to clone this voice.
                  </div>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/[0.04]">
                <button
                  type="button"
                  onClick={() => setShowCloneModal(false)}
                  className="px-3.5 py-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1c1c20] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCloning || !cloneConsent || !cloneName.trim() || !cloneFile}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isCloning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  <span>{isCloning ? 'Cloning voice...' : 'Clone voice'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}