'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { makeQueryClient } from '@/lib/queryClient';

/**
 * `useState(() => makeQueryClient())` (not a module-level `new
 * QueryClient()`) is the standard SSR-safe pattern the React Query docs
 * themselves recommend: the initializer runs once per component instance,
 * so this survives React Strict Mode's double-invoke in development
 * without constructing two clients, and would survive per-request
 * isolation if a Server Component ever needed to render one (none does
 * today — see `queryClient.ts`'s own comment).
 */
export function QueryProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [queryClient] = useState(makeQueryClient);
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
