'use client';

import { useState, useEffect, useCallback } from 'react';
import { AgentRecord } from '@/types/agent';
import { fetchAgents, deleteAgent } from '@/lib/agents';

export function useAgents() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadAgents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchAgents();
      setAgents(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  const removeAgent = async (id: string) => {
    try {
      await deleteAgent(id);
    } catch (err) {
      console.warn('Failed to delete agent on server, removing locally', err);
    }
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  return { agents, loading, error, refresh: loadAgents, removeAgent };
}
