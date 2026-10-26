'use client';

import React, { useState } from 'react';
import { Save, Radio, Sliders, Globe, Layers, ShieldAlert } from 'lucide-react';
import { AgentConfiguration, AgentRecord } from '@/types/agent';
import { VoiceSample } from '@/types/voice';

interface ConfigurationEditorProps {
  initialConfig: AgentConfiguration;
  voices: VoiceSample[];
  savedAgent: AgentRecord | null;
  onSaveDraft: (config: AgentConfiguration, redirectToAgents?: boolean) => Promise<void>;
  onDeployRemote: (config?: AgentConfiguration) => Promise<void>;
  isSaving: boolean;
  isDeploying: boolean;
}

export function ConfigurationEditor({
  initialConfig,
  voices,
  savedAgent,
  onSaveDraft,
  onDeployRemote,
  isSaving,
  isDeploying,
}: ConfigurationEditorProps) {
  const [config, setConfig] = useState<AgentConfiguration>(initialConfig);
  const [activeSubTab, setActiveSubTab] = useState<'core' | 'prompt' | 'flow' | 'guardrails'>('core');

  const updateField = <K extends keyof AgentConfiguration>(key: K, value: AgentConfiguration[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="bg-[#121215] border-0 rounded-2xl p-6 space-y-6 shadow-sm">
      {/* Header and Stage Notice */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/[0.04]">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Step 3: Review & Customize Generated Spec
          </span>
          <h2 className="text-base font-semibold text-white tracking-tight mt-0.5">
            {config.name || 'Untitled Agent'}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSaveDraft(config, false)}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#1c1c20] hover:bg-[#25252a] text-zinc-300 text-xs font-medium transition-colors border-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Draft'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSaveDraft(config, true)}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black text-xs font-semibold transition-colors shadow-sm disabled:opacity-50 border-0"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Creating Agent...' : 'Save & View Agents'}</span>
          </button>

          <button
            type="button"
            onClick={() => onDeployRemote(config)}
            disabled={isDeploying}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border-0 text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isDeploying ? 'Deploying...' : 'Deploy to ElevenLabs'}</span>
          </button>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-white/[0.04] gap-2 overflow-x-auto">
        {[
          { id: 'core', label: 'Basic Details & Voice', icon: Sliders },
          { id: 'prompt', label: 'Instructions & Persona', icon: Globe },
          { id: 'flow', label: 'Conversation Flow', icon: Layers },
          { id: 'guardrails', label: 'Guardrails & Safety', icon: ShieldAlert },
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as typeof activeSubTab)}
              className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
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

      {/* Tab 1: Core */}
      {activeSubTab === 'core' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Agent Name</label>
            <input
              type="text"
              value={config.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Voice Selection</label>
            <select
              value={config.voice_id}
              onChange={(e) => updateField('voice_id', e.target.value)}
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all cursor-pointer"
            >
              <option value="21m00Tcm4TlvDq8ikWAM">Rachel (Calm & Professional)</option>
              <option value="AZnzlk1XvdvUeBnXmlld">Domi (Energetic & Friendly)</option>
              <option value="EXAVITQu4vr4xnSDxMaL">Bella (Warm & Expressive)</option>
              <option value="ErXwobaYiN019PkySvjV">Antoni (Clear & Confident)</option>
              {voices.map(v => (
                <option key={v.voice_id} value={v.voice_id}>
                  {v.name} ({v.category || 'Standard'})
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Description</label>
            <input
              type="text"
              value={config.description}
              onChange={(e) => updateField('description', e.target.value)}
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Welcome Message (First Spoken Sentence)</label>
            <input
              type="text"
              value={config.welcome_message}
              onChange={(e) => updateField('welcome_message', e.target.value)}
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Prompt & Persona */}
      {activeSubTab === 'prompt' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Personality Tone & Style</label>
            <input
              type="text"
              value={typeof config.personality === 'string' ? config.personality : `${config.personality?.tone || ''} - ${config.personality?.speaking_style || ''}`}
              onChange={(e) => updateField('personality', { ...config.personality, tone: e.target.value })}
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">System Instructions</label>
            <textarea
              rows={8}
              value={config.instructions || (config as any).system_instructions || ''}
              onChange={(e) => {
                updateField('instructions', e.target.value);
                (config as any).system_instructions = e.target.value;
              }}
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-4 text-xs font-mono text-zinc-200 outline-none resize-y transition-all"
            />
          </div>
        </div>
      )}

      {/* Tab 3: Conversation Flow */}
      {activeSubTab === 'flow' && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-400">
            Guided conversational turns navigating the caller inquiry.
          </p>
          <div className="space-y-2.5">
            {(config.conversation_flow?.steps || [
              { step_id: '1', title: 'Greeting', goal: 'Welcome caller and identify intent' },
              { step_id: '2', title: 'Gather Information', goal: 'Collect necessary parameters or dates' },
              { step_id: '3', title: 'Action / Resolution', goal: 'Resolve inquiry or book appointment' },
              { step_id: '4', title: 'Escalation', goal: 'Transfer to senior team member if needed' },
            ]).map((s, idx) => (
              <div key={idx} className="flex items-center gap-3.5 p-3.5 bg-[#1c1c20] rounded-xl border-0">
                <span className="w-6 h-6 rounded-lg bg-[#25252a] text-zinc-300 font-mono text-xs flex items-center justify-center shrink-0 border-0 tabular-nums">
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

      {/* Tab 4: Guardrails & Tools */}
      {activeSubTab === 'guardrails' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Topics to Avoid (Guardrails)</label>
            <input
              type="text"
              value={(config.guardrails?.prohibited_topics || (config.guardrails as any)?.topics_to_avoid || []).join(', ')}
              onChange={(e) => {
                const topics = e.target.value.split(',').map(t => t.trim());
                updateField('guardrails', { ...config.guardrails, prohibited_topics: topics });
              }}
              placeholder="e.g. passwords, billing disputes, political opinions"
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-zinc-300 block mb-2">Fallback Policy / Message</label>
            <input
              type="text"
              value={config.guardrails?.fallback_message || 'Let me connect you with a senior specialist who can assist further.'}
              onChange={(e) => {
                updateField('guardrails', { ...config.guardrails, fallback_message: e.target.value });
              }}
              className="w-full bg-[#1c1c20] border-0 focus:ring-1 focus:ring-white/20 rounded-xl p-3 text-xs text-white outline-none transition-all"
            />
          </div>
        </div>
      )}
    </div>
  );
}
