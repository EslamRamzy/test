'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { useCurrentUser } from '@/features/admin/hooks/useCurrentUser';
import { useLogout } from '@/features/admin/hooks/useLogout';

/** Same labels as `Sidebar.tsx`'s `NAV_ITEMS` — kept as a separate small map here rather than importing that array, since a breadcrumb only ever needs the one label for the current path, not the full nav model (enabled state, icon, badge). */
const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Dashboard',
  projects: 'Projects',
  articles: 'Articles',
  'security-research': 'Security Research',
  skills: 'Skills',
  technologies: 'Technologies',
  certifications: 'Certifications',
  experience: 'Experience',
  education: 'Education',
  timeline: 'Timeline',
  media: 'Media',
  messages: 'Messages',
  settings: 'Settings',
  'audit-logs': 'Audit Logs',
  'change-password': 'Change password',
};

function breadcrumbLabel(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1] ?? 'admin';
  return SEGMENT_LABELS[last] ?? last;
}

/**
 * doc 07 §1: "breadcrumb · global ⌘K · theme · user menu." The `⌘K`
 * command palette is deliberately not here yet — a real one needs a
 * command registry spanning modules that don't exist until Phase 8 (doc
 * 11 §50: don't build ahead of need); adding it once there is something
 * for it to jump to is a small, contained addition on top of this Topbar,
 * not a redesign of it.
 *
 * The user menu's logout is a plain click for now, not yet behind
 * `ConfirmDialog` (task: "Toast system + ConfirmDialog shared primitives"
 * — built next, specifically to retrofit this).
 */
export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }): React.JSX.Element {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="admin-topbar">
      <button
        type="button"
        className="btn btn-sm btn-outline-secondary admin-topbar__menu-toggle"
        aria-label="Toggle navigation"
        aria-controls="admin-sidebar"
        onClick={onToggleSidebar}
      >
        <span className="bi bi-list" aria-hidden="true" />
      </button>

      <nav aria-label="Breadcrumb" className="admin-topbar__breadcrumb">
        <span className="bi bi-house" aria-hidden="true" />
        <span className="admin-topbar__breadcrumb-sep">/</span>
        <span>{breadcrumbLabel(pathname)}</span>
      </nav>

      <div className="admin-topbar__actions">
        <ThemeToggle />

        <div className="admin-topbar__user">
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
          >
            <span className="bi bi-person-circle me-1" aria-hidden="true" />
            {user?.name ?? '…'}
          </button>

          {menuOpen && (
            <div className="admin-topbar__user-menu" role="menu">
              <div className="admin-topbar__user-menu-header">
                <div>{user?.email}</div>
                <div className="admin-topbar__user-menu-role">{user?.role}</div>
              </div>
              <button
                type="button"
                role="menuitem"
                className="admin-topbar__user-menu-item"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                <span className="bi bi-box-arrow-right me-2" aria-hidden="true" />
                {logout.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
