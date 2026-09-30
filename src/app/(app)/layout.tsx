'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStore } from '@/components/store';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { DetailPanel } from '@/components/DetailPanel';
import { ModalHost } from '@/components/modals/ModalHost';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { authStatus } = useStore();
  const router = useRouter();

  useEffect(() => {
    // Signed-out visitors return here after signing in (e.g. from a copied task link).
    if (authStatus === 'signedOut') router.replace('/?next=' + encodeURIComponent(location.pathname + location.search));
    if (authStatus === 'noAccess') router.replace('/');
  }, [authStatus, router]);

  if (authStatus !== 'signedIn') return null;

  return (
    <>
      <div id="screen-app" className="screen active">
        <Sidebar />
        <div className="app-main">
          <Topbar />
          {/* Pages read the URL's ?query with useSearchParams, which needs a Suspense boundary to build. */}
          <Suspense fallback={null}>
            {children}
            <OpenTaskFromUrl />
          </Suspense>
        </div>
      </div>
      <DetailPanel />
      <ModalHost />
      <ConfirmDialog />
    </>
  );
}

/** ?task=<id> (from a task's Copy Link) opens that task's panel once it has loaded. */
function OpenTaskFromUrl() {
  const taskId = useSearchParams().get('task');
  const { projects, setSelectedPid } = useStore();
  const opened = useRef<string | null>(null);
  const found = !!taskId && projects.some(p => p.id === taskId);
  useEffect(() => {
    if (found && opened.current !== taskId) { opened.current = taskId; setSelectedPid(taskId); }
  }, [found, taskId, setSelectedPid]);
  return null;
}
