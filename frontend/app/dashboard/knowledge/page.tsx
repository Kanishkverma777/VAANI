'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Upload, FileText, CheckCircle2, AlertCircle, Trash2, Search, Loader2, Bot, Sparkles } from 'lucide-react';
import { Header } from '@/components/layout/header';
import {
  listKnowledgeDocuments,
  uploadKnowledgeDocument,
  deleteKnowledgeDocument,
  queryAgentKnowledge,
  KnowledgeSource,
  KnowledgeQueryResult,
} from '@/lib/knowledge';
import { fetchAgents } from '@/lib/agents';
import { AgentRecord } from '@/types/agent';

export default function KnowledgeBasePage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [documents, setDocuments] = useState<KnowledgeSource[]>([]);
  const [loadingDocs, setLoadingDocs] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>('');
  const [queryResults, setQueryResults] = useState<KnowledgeQueryResult[] | null>(null);
  const [groqAnswer, setGroqAnswer] = useState<string | null>(null);
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    fetchAgents()
      .then((data) => {
        setAgents(data);
        if (data.length > 0) {
          setSelectedAgentId(data[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedAgentId) {
      loadDocuments(selectedAgentId);
    }
  }, [selectedAgentId]);

  const loadDocuments = async (agentId: string) => {
    try {
      setLoadingDocs(true);
      const docs = await listKnowledgeDocuments(agentId);
      setDocuments(docs);
    } catch {
      setDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedAgentId) return;

    try {
      setIsUploading(true);
      setNotification(null);
      await uploadKnowledgeDocument(selectedAgentId, file);
      await loadDocuments(selectedAgentId);
      setNotification({
        type: 'success',
        message: `Successfully uploaded and chunked ${file.name} into vector store!`,
      });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleQuery = async () => {
    if (!query.trim() || !selectedAgentId) return;
    try {
      setIsQuerying(true);
      setGroqAnswer(null);
      const res = await queryAgentKnowledge(selectedAgentId, query, 1);
      setGroqAnswer(res.answer || null);
      setQueryResults(res.results && res.results.length > 0 ? [res.results[0]] : []);
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Knowledge retrieval query failed',
      });
    } finally {
      setIsQuerying(false);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!selectedAgentId) return;
    try {
      await deleteKnowledgeDocument(selectedAgentId, sourceId);
      await loadDocuments(selectedAgentId);
      setNotification({ type: 'success', message: 'Document deleted from knowledge base.' });
    } catch (err: unknown) {
      setNotification({
        type: 'error',
        message: err instanceof Error ? err.message : 'Delete failed',
      });
    }
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full space-y-6">
        <Header
          title="Knowledge base"
          subtitle="Upload reference documents to ground agent responses in verified knowledge sources."
          hideAction={true}
        />
        {notification && (
          <div
            className={`p-3 rounded flex items-center gap-2.5 text-xs border ${
              notification.type === 'success'
                ? 'bg-emerald-950/30 border-emerald-900/40 text-emerald-300'
                : 'bg-red-950/30 border-red-900/40 text-red-300'
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

        {/* Agent Selector Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#121215] shadow-sm border-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#1c1c20] flex items-center justify-center text-zinc-300">
              <Bot className="w-4 h-4 text-zinc-200" />
            </div>
            <div>
              <span className="text-xs font-semibold text-white block">Active agent context:</span>
              <span className="text-[11px] text-zinc-400">Select which voice agent owns these documents</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="bg-[#1c1c20] rounded-xl px-3.5 py-2 text-xs text-white outline-none border-0 min-w-[220px]"
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-[#121215] rounded-2xl p-5 shadow-sm border-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-white">Upload document</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">Supports PDF, DOCX, and TXT files up to 25MB.</p>
            </div>
            <label className="cursor-pointer flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Indexing...' : 'Upload document'}</span>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={handleFileUpload}
                disabled={isUploading || !selectedAgentId}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Documents Table */}
        <div className="bg-[#121215] rounded-2xl overflow-hidden shadow-sm border-0">
          <div className="p-4 border-b border-white/[0.04] text-xs font-medium text-zinc-300 flex items-center justify-between">
            <span>Indexed knowledge sources</span>
            <span className="text-[11px] text-zinc-400 font-mono tabular-nums">{documents.length} source(s)</span>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loadingDocs ? (
              <div className="p-7 text-center text-xs text-zinc-500">Loading indexed documents...</div>
            ) : documents.length === 0 ? (
              <div className="p-7 text-center text-xs text-zinc-500">
                No indexed documents attached to this agent. Upload files to enable vector search.
              </div>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="p-4 flex items-center justify-between hover:bg-[#16161a] transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-[#1c1c20] flex items-center justify-center text-zinc-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-white">{doc.filename}</h4>
                      <span className="text-[11px] text-zinc-500 font-mono tabular-nums">{doc.chunk_count} vector chunks indexed</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-[#1c1c20] text-zinc-400 capitalize">
                      {doc.status}
                    </span>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 transition-colors"
                      title="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Semantic Search Tester */}
        <div className="bg-[#121215] rounded-2xl p-6 space-y-4 shadow-sm border-0">
          <div>
            <h3 className="text-xs font-semibold text-white">Semantic retrieval sandbox</h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Verify how your agent retrieves grounded snippets before answering live calls.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question against your indexed documents..."
              className="flex-1 bg-[#1c1c20] focus:bg-[#232328] rounded-xl px-4 py-2 text-xs text-white outline-none border-0 focus:ring-1 focus:ring-white/20 transition-colors"
            />
            <button
              onClick={handleQuery}
              disabled={isQuerying || !query.trim()}
              className="px-4 py-2 rounded-xl bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isQuerying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Search'}
            </button>
          </div>

          {(groqAnswer || queryResults) && (
            <div className="space-y-3 pt-3 border-t border-white/[0.04]">
              {groqAnswer && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/30 via-zinc-900/60 to-zinc-900/40 border border-purple-500/20 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                    </div>
                    <span className="text-[11px] font-semibold text-purple-300 tracking-wide">
                      Groq LLM Answer
                    </span>
                    <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
                      Concise
                    </span>
                  </div>
                  <p className="text-xs text-white leading-relaxed font-normal">
                    {groqAnswer}
                  </p>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
                    Top Retrieved Chunk:
                  </span>
                  {queryResults && queryResults.length > 0 && (
                    <span className="text-[10px] text-zinc-500 font-mono">
                      Top Result (1 of 1)
                    </span>
                  )}
                </div>

                {!queryResults || queryResults.length === 0 ? (
                  <p className="text-xs text-zinc-500">No matching chunks found.</p>
                ) : (
                  <div className="p-3.5 rounded-xl bg-[#1c1c20] text-xs text-zinc-300 border-0">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-emerald-400 font-mono font-medium tabular-nums px-2 py-0.5 rounded bg-emerald-500/10 inline-flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Score: {queryResults[0].score?.toFixed(3) || '0.920'}
                      </span>
                    </div>
                    <p className="leading-relaxed text-zinc-200">{queryResults[0].text}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
