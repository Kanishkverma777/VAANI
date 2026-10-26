'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { PromptBuilder } from '@/components/agents/prompt-builder';
import { VoicePromptCreator } from '@/components/agents/voice-prompt-creator';
import { AgentConfigurationModal } from '@/components/agents/agent-configuration-modal';
import { generateAgentConfig, createAgent, deployAgent } from '@/lib/agents';
import { fetchVoices } from '@/lib/voices';
import { AgentConfiguration, AgentRecord, UseCase } from '@/types/agent';
import { VoiceSample } from '@/types/voice';
import { CheckCircle2, AlertCircle, Edit3, Mic } from 'lucide-react';

export default function NewAgentPage() {
  const router = useRouter();
  const [creationMode, setCreationMode] = useState<'manual' | 'speak'>('manual');
  const [voices, setVoices] = useState<VoiceSample[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Dialog State (Smooth creation animation -> Configuration & Deploy popup)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStage, setModalStage] = useState<'creating' | 'configure'>('creating');
  const [generatedConfig, setGeneratedConfig] = useState<AgentConfiguration | null>(null);
  const [savedAgent, setSavedAgent] = useState<AgentRecord | null>(null);

  useEffect(() => {
    fetchVoices()
      .then(setVoices)
      .catch(() => {});
  }, []);

  // Shared creation flow for both Manual and Speak Prompt methods
  const triggerAgentCreationFlow = async (
    promptText: string,
    useCase: UseCase,
    language: string
  ) => {
    try {
      setIsGenerating(true);
      setNotification(null);
      setIsModalOpen(true);
      setModalStage('creating');

      // Run generation API in parallel with minimum smooth animation duration (2000ms)
      const animationTimer = new Promise((resolve) => setTimeout(resolve, 2000));
      const generationPromise = generateAgentConfig(promptText, useCase, language);

      const [res] = await Promise.all([generationPromise, animationTimer]);

      setGeneratedConfig(res.configuration);
      setModalStage('configure');
    } catch (err: unknown) {
      setIsModalOpen(false);
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to generate agent configuration',
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // 1. Manual Method trigger
  const handleManualGenerate = async (prompt: string, useCase: UseCase, preferredLanguage: string) => {
    await triggerAgentCreationFlow(prompt, useCase, preferredLanguage);
  };

  // 2. Speak Prompt Method trigger
  const handleVoiceGenerate = async (spokenPrompt: string, language: string) => {
    await triggerAgentCreationFlow(spokenPrompt, 'customer_support', language);
  };

  // Modal Action 1: Save Draft
  const handleModalSaveDraft = async (config: AgentConfiguration) => {
    try {
      setIsSaving(true);
      setNotification(null);
      const record = await createAgent(
        config.name,
        config.description || '',
        config.use_case || 'customer_support',
        config
      );
      setSavedAgent(record);
      setIsModalOpen(false);
      setNotification({
        type: 'success',
        message: `Agent "${record.name}" saved as draft! Redirecting to agents list...`,
      });
      setTimeout(() => {
        router.push('/dashboard/agents');
      }, 700);
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to save agent draft',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Modal Action 2: Deploy to ElevenLabs
  const handleModalDeploy = async (config: AgentConfiguration) => {
    try {
      setIsDeploying(true);
      setNotification(null);
      // Save or update in database first
      let targetAgent = savedAgent;
      if (!targetAgent) {
        targetAgent = await createAgent(
          config.name,
          config.description || '',
          config.use_case || 'customer_support',
          config
        );
        setSavedAgent(targetAgent);
      }

      const res = await deployAgent(targetAgent.id);
      setIsModalOpen(false);
      setNotification({
        type: 'success',
        message: `Agent "${targetAgent.name}" deployed to ElevenLabs (Remote ID: ${res.elevenlabs_agent_id}). Opening workspace...`,
      });
      setTimeout(() => {
        router.push(`/dashboard/agents/${targetAgent!.id}`);
      }, 1000);
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to deploy agent to ElevenLabs',
      });
    } finally {
      setIsDeploying(false);
    }
  };

  // Modal Action 3: Deploy & Test Voice immediately in Playground
  const handleModalDeployAndTest = async (config: AgentConfiguration) => {
    try {
      setIsDeploying(true);
      setNotification(null);
      let targetAgent = savedAgent;
      if (!targetAgent) {
        targetAgent = await createAgent(
          config.name,
          config.description || '',
          config.use_case || 'customer_support',
          config
        );
        setSavedAgent(targetAgent);
      }

      await deployAgent(targetAgent.id);
      setIsModalOpen(false);
      setNotification({
        type: 'success',
        message: `Agent published and ready! Launching test playground...`,
      });
      setTimeout(() => {
        router.push(`/dashboard/agents/${targetAgent!.id}/playground`);
      }, 800);
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to deploy agent. You can still test in draft mode.',
      });
      // Fallback: if deploy fails due to remote API key/quota, still open playground with local agent
      if (savedAgent) {
        setIsModalOpen(false);
        router.push(`/dashboard/agents/${savedAgent.id}/playground`);
      }
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full space-y-6">
        <Header
          title="Agent builder"
          subtitle="Prompt-to-Agent Studio — Generate, customize, save, and deploy conversational voice agents."
          hideAction={true}
        />
        {notification && (
          <div
            className={`p-3.5 rounded-lg flex items-center gap-2.5 text-xs border ${
              notification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                : 'bg-red-950/40 border-red-800/40 text-red-300'
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

        {/* Two Options: Manual (Default) vs Speak Prompt */}
        <div className="flex items-center gap-1 p-1 bg-[#121215] rounded-xl border-0 w-fit">
          <button
            type="button"
            onClick={() => setCreationMode('manual')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border-0 ${
              creationMode === 'manual'
                ? 'bg-[#1c1c20] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Manual (default)</span>
          </button>
          <button
            type="button"
            onClick={() => setCreationMode('speak')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all border-0 ${
              creationMode === 'speak'
                ? 'bg-[#1c1c20] text-white shadow-sm'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Speak prompt</span>
          </button>
        </div>

        {/* Mode Views: Step 3 is removed from the page */}
        {creationMode === 'manual' ? (
          <PromptBuilder onGenerate={handleManualGenerate} isGenerating={isGenerating} />
        ) : (
          <VoicePromptCreator
            onCreateAgent={handleVoiceGenerate}
            isCreating={isGenerating}
          />
        )}
      </div>

      {/* Pop-up Dialog Box: Smooth Creation Animation -> Configure, Deploy & Test */}
      <AgentConfigurationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        stage={modalStage}
        initialConfig={generatedConfig}
        voices={voices}
        onSaveDraft={handleModalSaveDraft}
        onDeploy={handleModalDeploy}
        onDeployAndTest={handleModalDeployAndTest}
        isSaving={isSaving}
        isDeploying={isDeploying}
      />
    </div>
  );
}
