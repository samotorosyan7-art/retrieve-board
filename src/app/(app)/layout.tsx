'use client';

import { Suspense, useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ADMIN_PAGES, homePath } from '@/lib/helpers';
import { useStore } from '@/components/store';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { DetailPanel } from '@/components/DetailPanel';
import { ModalHost } from '@/components/modals/ModalHost';
import { ConfirmDialog } from '@/components/modals/ConfirmDialog';
import { LockIcon } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { authStatus, passwordRecovery, currentUser, toast } = useStore();
  const router = useRouter();
  const page = usePathname().split('/')[1] || 'dashboard';
  const blocked = authStatus === 'signedIn' && !currentUser?.isAdmin && ADMIN_PAGES.includes(page);

  useEffect(() => {
    // Signed-out visitors return here after signing in (e.g. from a copied task link).
    if (authStatus === 'signedOut') router.replace('/?next=' + encodeURIComponent(location.pathname + location.search));
    if (authStatus === 'noAccess') router.replace('/');
    // Signed in from a password-reset link: set the new password before using the app.
    if (passwordRecovery) router.replace('/reset-password');
  }, [authStatus, passwordRecovery, router]);

  // Members can't open admin pages (Dashboard, Team Workload, Clients, Logs, Settings).
  useEffect(() => {
    if (!blocked) return;
    toast(LockIcon, 'Access denied', 'That section is for admins only.');
    router.replace(homePath(currentUser));
  }, [blocked, currentUser, router, toast]);

  if (authStatus !== 'signedIn' || passwordRecovery || blocked) return null;

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
