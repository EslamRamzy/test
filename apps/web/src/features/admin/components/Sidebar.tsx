'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOverview } from '@/features/admin/hooks/useOverview';

/**
 * Order and module list per docs/architecture/07 §1/§51 exactly: Dashboard,
 * Projects, Articles, Security Research, Skills, Technologies,
 * Certifications, Experience, Education, Timeline, Media, Messages,
 * Settings, Audit Logs. Analytics and Profile are deliberately NOT in this
 * list either — §51 names exactly these 14, and both are reached from a
 * link on the Settings page instead (same "closest-fit module, not a new
 * nav entry" pattern as Skill Categories living under Skills).
 *
 * `enabled: false` remains only on Messages — Phase 9 shipped Media's own
 * `/admin/media` library (doc07 §3), flipping its item to `true` below;
 * Messages is Phase 10's scope (Contact + messages) and was never in this
 * phase's task list, so linking to it today would 404. Flip an item's
 * `enabled` to `true` in the same commit that ships its route, nothing else
 * here needs to change.
 */
const NAV_ITEMS = [
  { label: 'Dashboard', href: '/admin', icon: 'bi-speedometer2', enabled: true },
  { label: 'Projects', href: '/admin/projects', icon: 'bi-kanban', enabled: true },
  { label: 'Articles', href: '/admin/articles', icon: 'bi-file-text', enabled: true },
  {
    label: 'Security Research',
    href: '/admin/security-research',
    icon: 'bi-shield-lock',
    enabled: true,
  },
  { label: 'Skills', href: '/admin/skills', icon: 'bi-stars', enabled: true },
  { label: 'Technologies', href: '/admin/technologies', icon: 'bi-cpu', enabled: true },
  {
    label: 'Certifications',
    href: '/admin/certifications',
    icon: 'bi-patch-check',
    enabled: true,
  },
  { label: 'Experience', href: '/admin/experience', icon: 'bi-briefcase', enabled: true },
  { label: 'Education', href: '/admin/education', icon: 'bi-mortarboard', enabled: true },
  { label: 'Timeline', href: '/admin/timeline', icon: 'bi-clock-history', enabled: true },
  { label: 'Media', href: '/admin/media', icon: 'bi-images', enabled: true },
  { label: 'Messages', href: '/admin/messages', icon: 'bi-envelope', enabled: false },
  { label: 'Settings', href: '/admin/settings', icon: 'bi-gear', enabled: true },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: 'bi-journal-text', enabled: true },
] as const;

function isActive(pathname: string, href: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
}

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const pathname = usePathname();
  // No fake data (doc 07 §6) — the Messages badge is the same real query
  // the dashboard page renders from, not a hardcoded placeholder.
  const { data: overview } = useOverview();

  return (
    <>
      {/* Off-canvas below `lg` (doc 07 §1): a backdrop click closes it, same
          as any drawer. Above `lg`, `.admin-sidebar` is always visible and
          this backdrop never renders (see `_components.scss`). */}
      {open && (
        <button
          type="button"
          className="admin-sidebar__backdrop"
          aria-label="Close navigation"
          onClick={onClose}
        />
      )}
      <nav
        id="admin-sidebar"
        className={`admin-sidebar${open ? ' admin-sidebar--open' : ''}`}
        aria-label="Admin navigation"
      >
        <div className="admin-sidebar__brand">
          <span className="admin-auth__brand-dot" aria-hidden="true" />
          Eslam Ramzy
        </div>
        <ul className="admin-sidebar__list">
          {NAV_ITEMS.map((item) => {
            const unreadCount =
              item.label === 'Messages' ? (overview?.unreadMessagesCount ?? 0) : 0;

            if (!item.enabled) {
              return (
                <li key={item.href} className="admin-sidebar__item">
                  <span
                    className="admin-sidebar__link admin-sidebar__link--disabled"
                    aria-disabled="true"
                    title="Coming soon"
                  >
                    <span className={`bi ${item.icon}`} aria-hidden="true" />
                    {item.label}
                    <span className="admin-sidebar__soon">Soon</span>
                  </span>
                </li>
              );
            }

            return (
              <li key={item.href} className="admin-sidebar__item">
                <Link
                  href={item.href}
                  className={`admin-sidebar__link${isActive(pathname, item.href) ? ' admin-sidebar__link--active' : ''}`}
                  onClick={onClose}
                >
                  <span className={`bi ${item.icon}`} aria-hidden="true" />
                  {item.label}
                  {unreadCount > 0 && <span className="admin-sidebar__badge">{unreadCount}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
