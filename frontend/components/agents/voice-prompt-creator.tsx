'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Loader2,
  RotateCcw,
  Volume2,
  AlertCircle,
  Radio,
  CheckCircle2,
} from 'lucide-react';
import { AudioReactiveOrb } from '@/components/ui/audio-reactive-orb';
import { BUILDER_LANGUAGES } from '@/lib/languages';

interface VoicePromptCreatorProps {
  onCreateAgent: (spokenPrompt: string, language: string) => Promise<void>;
  isCreating: boolean;
}

const LANGUAGE_OPTIONS = BUILDER_LANGUAGES;

export function VoicePromptCreator({ onCreateAgent, isCreating }: VoicePromptCreatorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [spokenPrompt, setSpokenPrompt] = useState<string>('');
  const [interimTranscript, setInterimTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  const currentLangObj =
    LANGUAGE_OPTIONS.find((l) => l.code === selectedLanguage) || LANGUAGE_OPTIONS[0];

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      setIsListening(false);
      setInterimTranscript('');
      return;
    }

    if (typeof window === 'undefined') return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSpeechError(
        'Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Apple Safari.'
      );
      return;
    }

    try {
      setSpeechError(null);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = currentLangObj.locale;

      let baseText = spokenPrompt.trim();
      if (baseText.length > 0) {
        baseText += ' ';
      }

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let finalized = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const chunk = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalized += chunk + ' ';
          } else {
            interim += chunk;
          }
        }

        if (finalized) {
          baseText += finalized;
        }

        setInterimTranscript(interim);
        setSpokenPrompt((baseText + interim).slice(0, 1500));
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access in your browser.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Speech recognition notice: ${event.error}`);
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Speech recognition start failed:', err);
      setIsListening(false);
      setSpeechError('Could not start audio recording. Please verify your microphone.');
    }
  };

  const handleClear = () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }
    setSpokenPrompt('');
    setInterimTranscript('');
    setSpeechError(null);
  };

  const handleCreate = async () => {
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
    }
    const finalPrompt = spokenPrompt.trim();
    if (!finalPrompt || isCreating) return;
    await onCreateAgent(finalPrompt, selectedLanguage);
  };

  return (
    <div className="bg-[#121215] rounded-2xl p-6 shadow-sm border-0 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.04] pb-4">
        <div>
          <div className="flex items-center gap-1.5 text-zinc-400 font-medium text-[11px] uppercase tracking-wider mb-1">
            <Mic className="w-3.5 h-3.5 text-emerald-400" />
            <span>Voice prompt creator</span>
          </div>
          <h2 className="text-sm font-semibold text-white tracking-tight">
            Speak your voice agent prompt
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            No typing needed. Just speak the persona, role, and duties into your microphone.
          </p>
        </div>

        {/* Language Selector (Matches Manual tab: EN, HI, ES, FR, DE) */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400 font-medium hidden sm:inline">Primary language:</span>
          <div className="inline-flex rounded-xl p-1 bg-[#1c1c20] border-0">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setSelectedLanguage(lang.code);
                  if (isListening && recognitionRef.current) {
                    try {
                      recognitionRef.current.stop();
                    } catch {}
                    setIsListening(false);
                  }
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors border-0 ${
                  selectedLanguage === lang.code
                    ? 'bg-white text-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {lang.code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {speechError && (
        <div className="p-3.5 rounded-xl bg-red-950/40 text-red-300 text-xs flex items-center gap-2 border-0">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Audio-Reactive Glowing Voice Orb (Image 1) */}
      <div className="py-4 flex flex-col items-center justify-center">
        <AudioReactiveOrb
          isListening={isListening}
          onToggle={toggleListening}
          size={250}
          statusText={
            isListening
              ? `Listening in ${currentLangObj.label}... Speak clearly now.`
              : spokenPrompt.trim()
              ? 'Click to speak more, or create agent below.'
              : `Tap the orb or button to speak in ${currentLangObj.label}.`
          }
          hintText='Example: "Create a warm receptionist for BrightSmile Dental who books appointments and confirms timings."'
          disabled={isCreating}
        />
      </div>

      {/* Live Transcribed Prompt Container */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-zinc-400">
          <span className="font-medium flex items-center gap-1.5 text-[11px]">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            Spoken prompt transcription
          </span>
          {spokenPrompt.trim() && (
            <button
              type="button"
              onClick={handleClear}
              className="flex items-center gap-1 text-zinc-400 hover:text-red-400 transition-colors text-[11px]"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear & re-speak</span>
            </button>
          )}
        </div>

        <div
          className={`w-full min-h-[90px] rounded-xl p-4 text-xs transition-colors border-0 ${
            isListening
              ? 'bg-[#1c1c20] ring-1 ring-emerald-500/50 text-white'
              : spokenPrompt.trim()
              ? 'bg-[#1c1c20] text-zinc-100'
              : 'bg-[#1c1c20]/60 text-zinc-500 italic'
          }`}
        >
          {spokenPrompt.trim() || interimTranscript ? (
            <p className="leading-relaxed whitespace-pre-wrap font-sans text-xs">
              {spokenPrompt}
              {interimTranscript && (
                <span className="text-emerald-400/80 animate-pulse"> {interimTranscript}</span>
              )}
            </p>
          ) : (
            <p className="text-zinc-500 text-xs">
              Your speech will be transcribed here in real-time. Everything you speak will be used to generate your complete ElevenLabs voice agent.
            </p>
          )}
        </div>
      </div>

      {/* Direct Create Agent Button */}
      <div className="pt-3 flex items-center justify-between gap-4 border-t border-white/[0.04]">
        <div className="text-[11px] text-zinc-500 font-mono">
          {spokenPrompt.trim() ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Ready ({spokenPrompt.length} chars)
            </span>
          ) : (
            <span>Speak your requirements above to enable creation</span>
          )}
        </div>

        <button
          type="button"
          disabled={!spokenPrompt.trim() || isCreating}
          onClick={handleCreate}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed border-0"
        >
          {isCreating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Building agent...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5" />
              <span>Create agent</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
