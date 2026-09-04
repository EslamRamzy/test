import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/styles/globals.scss';

/**
 * Phase 6 replaces this with database-driven metadata built from `site_settings`
 * and the `profiles` row. Nothing here is content — it is scaffolding.
 */
export const metadata: Metadata = {
  title: 'Eslam Ramzy',
  description: 'Full-stack development and application security.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
