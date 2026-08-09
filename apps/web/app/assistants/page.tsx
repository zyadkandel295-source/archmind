'use client';

import React, { useState } from 'react';
import { ImmersiveWorkspace } from '@/components/workspace/immersive-workspace';
import { AdvancedDashboard } from '@/components/dashboard/dashboard-layout';
import { DashboardGuard } from '@/components/dashboard-guard';

export default function WorkspacePage() {
  const [view, setView] = useState<'workspace' | 'dashboard'>('workspace');

  return (
    <DashboardGuard>
      {view === 'workspace' ? (
        <ImmersiveWorkspace />
      ) : (
        <AdvancedDashboard />
      )}
    </DashboardGuard>
  );
}
