'use client';

import React, { useEffect, useState } from 'react';
import { VoiceDashboard } from '@/components/dashboard/voice-dashboard';
import { useAgents } from '@/hooks/use-agents';
import { fetchAnalyticsOverview } from '@/lib/analytics';
import { fetchUserSessions } from '@/lib/conversations';
import { AnalyticsSummary, ConversationSession } from '@/types/session';
import { getStoredUser } from '@/lib/api-client';

export default function DashboardPage() {
  const { agents, loading, refresh, removeAgent } = useAgents();
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [user, setUser] = useState<{ email?: string; full_name?: string } | null>(null);

  const loadDashboardData = React.useCallback(async () => {
    // Non-blocking parallel fetches for instant UI response (<10ms)
    fetchAnalyticsOverview()
      .then((data) => {
        if (data) setAnalytics(data);
      })
      .catch(() => {});

    fetchUserSessions(1, 10, false)
      .then((sess) => {
        if (sess && sess.length > 0) setSessions(sess);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setUser(getStoredUser());
    loadDashboardData();
  }, [loadDashboardData]);

  const handleRefresh = async () => {
    refresh();
    await Promise.allSettled([
      fetchAnalyticsOverview().then((data) => data && setAnalytics(data)),
      fetchUserSessions(1, 10, false).then((sess) => sess && setSessions(sess)),
    ]);
  };

  const greetingName = user?.full_name || 'Kanishk';

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#000000]">
      <div className="p-4 sm:p-6 lg:p-8 pb-16 max-w-[1280px] mx-auto w-full">
        <VoiceDashboard
          agents={agents}
          analytics={analytics}
          sessions={sessions}
          loading={loading}
          onRefresh={handleRefresh}
          onDeleteAgent={removeAgent}
          userName={greetingName}
        />
      </div>
    </div>
  );
}
