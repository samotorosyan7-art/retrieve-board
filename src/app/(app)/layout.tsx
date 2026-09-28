'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
    if (authStatus === 'signedOut' || authStatus === 'noAccess') router.replace('/');
  }, [authStatus, router]);

  if (authStatus !== 'signedIn') return null;

  return (
    <>
      <div id="screen-app" className="screen active">
        <Sidebar />
        <div className="app-main">
          <Topbar />
          {children}
        </div>
      </div>
      <DetailPanel />
      <ModalHost />
      <ConfirmDialog />
    </>
  );
}
