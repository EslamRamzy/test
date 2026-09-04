'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Sidebar } from '@/features/admin/components/Sidebar';
import { Topbar } from '@/features/admin/components/Topbar';

/**
 * `(protected)` is a route group, not a path segment — every route here
 * still resolves under plain `/admin/...`. It exists purely to give
 * authenticated, shell-having pages (the dashboard; Phase 8's 13 modules) a
 * different layout from `/admin/login` and `/admin/change-password`, which
 * sit as siblings OUTSIDE this group and render no Sidebar/Topbar at all —
 * neither assumes an established session yet.
 *
 * "Protected" here means only "has this shell," matching `proxy.ts`'s own
 * scope: an access-token cookie must be present to reach any `/admin/*`
 * route at all (this group included), but that check is a redirect, not a
 * security control (doc 04 §7) — the real authorization is every API call
 * this shell's pages make being independently checked by Express.
 */
export default function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-protected">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="admin-protected__main">
        <Topbar onToggleSidebar={() => setSidebarOpen((open) => !open)} />
        <main className="admin-protected__content">{children}</main>
      </div>
    </div>
  );
}
