'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { useToast } from '@/features/admin/components/ToastProvider';
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
 * Sign out goes through `<ConfirmDialog>` (doc 07 §2: "Required before
 * every destructive action") without `requireTypedConfirmation` — losing
 * an active session is disruptive but reversible (sign back in), unlike
 * deleting an entity, so a plain Yes/Cancel is enough here; typed
 * confirmation is reserved for Phase 8's actual deletes.
 */
export function Topbar({ onToggleSidebar }: { onToggleSidebar: () => void }): React.JSX.Element {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  function handleConfirmLogout(): void {
    logout.mutate(undefined, {
      onError: () => {
        setShowLogoutConfirm(false);
        toast.show({
          message: 'Signing out failed to reach the server. Please try again.',
          variant: 'danger',
        });
      },
      // No onSuccess handler here — `useLogout` itself navigates away on
      // success, which unmounts this component before any state update
      // here would matter.
    });
  }

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
                onClick={() => {
                  setMenuOpen(false);
                  setShowLogoutConfirm(true);
                }}
              >
                <span className="bi bi-box-arrow-right me-2" aria-hidden="true" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        show={showLogoutConfirm}
        title="Sign out?"
        message="You'll need to sign in again to get back to the admin dashboard."
        confirmLabel="Sign out"
        variant="primary"
        confirming={logout.isPending}
        onConfirm={handleConfirmLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </header>
  );
}
