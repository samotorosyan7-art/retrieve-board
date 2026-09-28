'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useStore } from './store';

export function useNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { closePanel, setSelectedPid } = useStore();
  const page = pathname.split('/')[1] || 'dashboard';
  return {
    page,
    /** Navigate to a page (closes the detail panel, like the original nav()). */
    go: (id: string) => { closePanel(); router.push('/' + id); },
    /** Jump to All Matters with a matter's detail panel open. */
    openMatter: (pid: string) => { router.push('/list'); setSelectedPid(pid); },
  };
}
