'use client';

import React, { useState } from 'react';
import { ImmersiveWorkspace } from '@/components/workspace/immersive-workspace';
import { AdvancedDashboard } from '@/components/dashboard/dashboard-layout';

export default function WorkspacePage() {
  const [view, setView] = useState<'workspace' | 'dashboard'>('workspace');

  return (
    <>
      {view === 'workspace' ? (
        <ImmersiveWorkspace />
      ) : (
        <AdvancedDashboard />
      )}
    </>
  );
}
