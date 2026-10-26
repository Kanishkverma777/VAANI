'use client';

import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, User, Key, CheckCircle2, ShieldCheck, Globe, Volume2, Save } from 'lucide-react';
import { Header } from '@/components/layout/header';
import { getStoredUser, setStoredUser } from '@/lib/api-client';

export default function SettingsPage() {
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);
  const [fullName, setFullName] = useState('Kanishk');
  const [email, setEmail] = useState('admin@vaani.ai');
  const [defaultLanguage, setDefaultLanguage] = useState('en');
  const [preferredVoice, setPreferredVoice] = useState('Rachel');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const u = getStoredUser();
    if (u) {
      setUser(u);
      if (u.full_name) setFullName(u.full_name);
      if (u.email) setEmail(u.email);
    }
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredUser({ full_name: fullName, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full space-y-6">
        <Header
          title="Settings & system integrations"
          subtitle="Manage your profile, platform defaults, and provider integrations."
          hideAction={true}
        />
        {saved && (
          <div className="p-3.5 rounded-xl bg-emerald-950/40 text-emerald-300 text-xs flex items-center gap-2 border-0">
            <CheckCircle2 className="w-4 h-4" />
            <span>Profile and preferences successfully saved!</span>
          </div>
        )}

        {/* Profile Card */}
        <form onSubmit={handleSave} className="bg-[#121215] rounded-2xl p-6 shadow-sm border-0 space-y-5">
          <div className="flex items-center gap-2 pb-3.5 border-b border-white/[0.04]">
            <User className="w-4 h-4 text-zinc-400" />
            <h3 className="font-semibold text-white text-xs">Profile details</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Display name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-[#1c1c20] rounded-xl p-3 text-xs text-white border-0 outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#1c1c20] rounded-xl p-3 text-xs text-white border-0 outline-none focus:ring-1 focus:ring-white/20 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end pt-3 border-t border-white/[0.04]">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save changes</span>
            </button>
          </div>
        </form>

        {/* Preferences */}
        <div className="bg-[#121215] rounded-2xl p-6 shadow-sm border-0 space-y-5">
          <div className="flex items-center gap-2 pb-3.5 border-b border-white/[0.04]">
            <Globe className="w-4 h-4 text-zinc-400" />
            <h3 className="font-semibold text-white text-xs">Default agent preferences</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Default language</label>
              <select
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                className="w-full bg-[#1c1c20] rounded-xl p-3 text-xs text-white border-0 outline-none focus:ring-1 focus:ring-white/20 transition-all"
              >
                <option value="en">English (US / UK)</option>
                <option value="hi">Hindi (हिन्दी)</option>
                <option value="es">Spanish (Español)</option>
                <option value="fr">French (Français)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-300 block mb-1.5">Preferred default voice</label>
              <select
                value={preferredVoice}
                onChange={(e) => setPreferredVoice(e.target.value)}
                className="w-full bg-[#1c1c20] rounded-xl p-3 text-xs text-white border-0 outline-none focus:ring-1 focus:ring-white/20 transition-all"
              >
                <option value="Rachel">Rachel (Calm & Clear)</option>
                <option value="Domi">Domi (Dynamic & Friendly)</option>
                <option value="Antoni">Antoni (Authoritative & Deep)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Integrations Status */}
        <div className="bg-[#121215] rounded-2xl p-6 shadow-sm border-0 space-y-4">
          <div className="flex items-center gap-2 pb-3.5 border-b border-white/[0.04]">
            <Key className="w-4 h-4 text-zinc-400" />
            <h3 className="font-semibold text-white text-xs">Provider connections</h3>
          </div>

          <div className="space-y-2">
            {[
              { name: 'ElevenLabs Conversational AI', status: 'Connected', badge: 'Active', desc: 'Real-time WebRTC TTS, STT, and voice cloning pipeline.' },
              { name: 'Groq LLM Acceleration', status: 'Connected', badge: 'Active', desc: 'Ultra-fast prompt-to-agent generation using LLaMA 3.3 70B.' },
              { name: 'MongoDB Atlas', status: 'Connected', badge: 'Active', desc: 'Agent versioning, conversation sessions, and analytics store.' },
              { name: 'RAG Vector Store', status: 'In-Memory Fallback Active', badge: 'Ready', desc: 'Document chunking and cosine similarity retrieval engine.' },
            ].map((p) => (
              <div key={p.name} className="flex items-center justify-between p-3.5 rounded-xl bg-[#1c1c20] border-0">
                <div>
                  <h4 className="text-xs font-medium text-white">{p.name}</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">{p.desc}</p>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-[#121215] text-zinc-300 border-0">
                  {p.badge}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
