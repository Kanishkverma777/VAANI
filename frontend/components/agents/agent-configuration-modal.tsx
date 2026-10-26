'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Radio,
  Sliders,
  Globe,
  Layers,
  ShieldAlert,
  Save,
  Mic,
  Loader2,
} from 'lucide-react';
import { AgentConfiguration } from '@/types/agent';
import { VoiceSample } from '@/types/voice';
import { AiThinkingGlobe } from '@/components/ui/ai-thiking-orb-and-input';
import { SUPPORTED_LANGUAGES } from '@/lib/languages';

interface AgentConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  stage: 'creating' | 'configure';
  initialConfig: AgentConfiguration | null;
  voices: VoiceSample[];
  onSaveDraft: (config: AgentConfiguration) => Promise<void>;
  onDeploy: (config: AgentConfiguration) => Promise<void>;
  onDeployAndTest: (config: AgentConfiguration) => Promise<void>;
  isSaving: boolean;
  isDeploying: boolean;
}

export function AgentConfigurationModal({
  isOpen,
  onClose,
  stage,
  initialConfig,
  voices,
  onSaveDraft,
  onDeploy,
  onDeployAndTest,
  isSaving,
  isDeploying,
}: AgentConfigurationModalProps) {
  const [config, setConfig] = useState<AgentConfiguration | null>(initialConfig);
  const [activeSubTab, setActiveSubTab] = useState<'core' | 'prompt' | 'flow' | 'guardrails'>('core');

  useEffect(() => {
    if (initialConfig) {
      setConfig(initialConfig);
    }
  }, [initialConfig]);

  if (!isOpen) return null;

  const updateField = <K extends keyof AgentConfiguration>(key: K, value: AgentConfiguration[K]) => {
    if (!config) return;
    setConfig({ ...config, [key]: value });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      {stage === 'creating' ? (
        /* ------------------------------------------------------------- */
        /*  STAGE 1: 3D Particle Thinking Globe Creation State           */
        /* ------------------------------------------------------------- */
        <div className="flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200 select-none">
          {/* Standalone 3D Particle Thinking Globe */}
          <AiThinkingGlobe
            size={240}
            statusMessage=""
            subMessage=""
            speed={1.2}
          />
          <div className="mt-5 flex items-center gap-2 text-xs font-mono text-zinc-300">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="tracking-wide">creating agent...</span>
          </div>
        </div>
      ) : (
        /* ------------------------------------------------------------- */
        /*  STAGE 2: Agent Configuration, Deploy & Test Dialog          */
        /* ------------------------------------------------------------- */
        config && (
          <div className="bg-[#121215] border-0 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-6 border-b border-white/[0.04] flex items-start justify-between gap-4 bg-[#121215]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                    Agent configured · Ready to deploy
                  </span>
                </div>
                <h2 className="text-lg font-bold text-white tracking-tight mt-1">
                  {config.name || 'Untitled Agent'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Review specifications, select ElevenLabs voice, then deploy and test immediately.
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1c1c20] transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sub Tabs */}
            <div className="flex border-b border-white/[0.04] px-6 bg-[#121215] gap-2 overflow-x-auto">
              {[
                { id: 'core', label: 'Basic details & voice', icon: Sliders },
                { id: 'prompt', label: 'Instructions & persona', icon: Globe },
                { id: 'flow', label: 'Conversation flow', icon: Layers },
                { id: 'guardrails', label: 'Guardrails & safety', icon: ShieldAlert },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
                    className={`flex items-center gap-2 py-3 px-3.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap -mb-px ${
                      active
                        ? 'border-white text-white'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
              {/* Tab 1: Core Details & Voice */}
              {activeSubTab === 'core' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">Agent name</label>
                    <input
                      type="text"
                      value={config.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">ElevenLabs voice selection</label>
                    <select
                      value={config.voice_id}
                      onChange={(e) => updateField('voice_id', e.target.value)}
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    >
                      <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Calm & Professional)</option>
                      <option value="AZnzlk1XvdvUeBnXmlld">Domi (Energetic & Friendly)</option>
                      <option value="EXAVITQu4vr4xnSDxMaL">Bella (Warm & Expressive)</option>
                      <option value="ErXwobaYiN019PkySvjV">Antoni (Clear & Confident)</option>
                      {voices.map((v) => (
                        <option key={v.voice_id} value={v.voice_id}>
                          {v.name} ({v.category || 'Standard'})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">Primary language</label>
                    <select
                      value={config.language || 'en'}
                      onChange={(e) => updateField('language', e.target.value)}
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    >
                      {SUPPORTED_LANGUAGES.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label} ({l.code.toUpperCase()})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">Description</label>
                    <input
                      type="text"
                      value={config.description || ''}
                      onChange={(e) => updateField('description', e.target.value)}
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                      Welcome message (First spoken greeting)
                    </label>
                    <input
                      type="text"
                      value={config.welcome_message || ''}
                      onChange={(e) => updateField('welcome_message', e.target.value)}
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Instructions & Persona */}
              {activeSubTab === 'prompt' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">Personality tone & speaking style</label>
                    <input
                      type="text"
                      value={
                        typeof config.personality === 'string'
                          ? config.personality
                          : `${config.personality?.tone || ''} - ${config.personality?.speaking_style || ''}`
                      }
                      onChange={(e) =>
                        updateField('personality', { ...config.personality, tone: e.target.value })
                      }
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">System instructions</label>
                    <textarea
                      rows={8}
                      value={config.instructions || (config as any).system_instructions || ''}
                      onChange={(e) => {
                        updateField('instructions', e.target.value);
                        (config as any).system_instructions = e.target.value;
                      }}
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3.5 text-xs font-mono text-zinc-200 outline-none focus:ring-1 focus:ring-white/20 transition-all resize-y"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Conversation Flow */}
              {activeSubTab === 'flow' && (
                <div className="space-y-3">
                  <p className="text-xs text-zinc-400">
                    Step-by-step conversational turns configured for this agent.
                  </p>
                  <div className="space-y-2">
                    {(config.conversation_flow?.steps || [
                      { step_id: '1', title: 'Greeting', goal: 'Welcome caller and identify intent' },
                      { step_id: '2', title: 'Information Gathering', goal: 'Collect caller requirements' },
                      { step_id: '3', title: 'Action & Resolution', goal: 'Provide solution or appointment' },
                    ]).map((s, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 p-3.5 bg-[#1c1c20] rounded-xl border-0"
                      >
                        <span className="w-6 h-6 rounded-lg bg-[#121215] text-zinc-300 font-semibold text-[11px] flex items-center justify-center shrink-0 border-0">
                          {idx + 1}
                        </span>
                        <div className="flex-1 grid grid-cols-2 gap-2">
                          <span className="text-xs font-semibold text-white">
                            {s.title || (s as any).intent}
                          </span>
                          <span className="text-xs text-zinc-400 truncate">
                            {s.goal || (s as any).action}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tab 4: Guardrails & Safety */}
              {activeSubTab === 'guardrails' && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                      Topics to avoid (Guardrails)
                    </label>
                    <input
                      type="text"
                      value={(config.guardrails?.prohibited_topics || []).join(', ')}
                      onChange={(e) => {
                        const topics = e.target.value.split(',').map((t) => t.trim());
                        updateField('guardrails', { ...config.guardrails, prohibited_topics: topics });
                      }}
                      placeholder="e.g. passwords, billing disputes, confidential internal data"
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-300 block mb-1.5">
                      Fallback policy / message
                    </label>
                    <input
                      type="text"
                      value={config.guardrails?.fallback_message || 'Let me connect you with a representative.'}
                      onChange={(e) => {
                        updateField('guardrails', { ...config.guardrails, fallback_message: e.target.value });
                      }}
                      className="w-full bg-[#1c1c20] border-0 rounded-xl p-3 text-xs text-white outline-none focus:ring-1 focus:ring-white/20 transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Actions: Deploy & Test */}
            <div className="p-4 sm:px-6 border-t border-white/[0.04] bg-[#121215] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-zinc-400 hover:text-white px-3 py-2 rounded-xl transition-colors"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onSaveDraft(config)}
                  disabled={isSaving || isDeploying}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c1c20] hover:bg-[#25252b] text-zinc-300 text-xs font-semibold transition-colors border-0 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSaving ? 'Saving...' : 'Save draft'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => onDeploy(config)}
                  disabled={isSaving || isDeploying}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 text-xs font-semibold transition-colors disabled:opacity-40 border-0"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{isDeploying ? 'Deploying...' : 'Deploy to ElevenLabs'}</span>
                </button>

                {/* Primary Action: Deploy and Test Voice immediately */}
                <button
                  type="button"
                  onClick={() => onDeployAndTest(config)}
                  disabled={isSaving || isDeploying}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors shadow-md disabled:opacity-50 border-0"
                >
                  {isDeploying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Launching playground...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      <span>Deploy & test</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
