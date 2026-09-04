'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Form from 'react-bootstrap/Form';

/** `<ResourceToolbar>` — "Debounced search, status filter, 'New' button" (doc07 §2). `statusValue`/`onStatusChange` are both omitted together for a resource with no editorial workflow (Skills, Technologies, ...). */
export interface ResourceToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  statusValue?: string | undefined;
  onStatusChange?: (value: string | undefined) => void;
  newHref?: string;
  newLabel?: string;
}

const DEBOUNCE_MS = 300;

export function ResourceToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search…',
  statusValue,
  onStatusChange,
  newHref,
  newLabel = 'New',
}: ResourceToolbarProps): React.JSX.Element {
  const [draft, setDraft] = useState(searchValue);

  // The parent's own `searchValue` can change from outside (e.g. a "clear
  // filters" action elsewhere) — keep the local draft in sync when it does,
  // without that sync re-triggering the debounce effect below. Deliberately
  // depends on `searchValue` alone: this project has no react-hooks plugin
  // to enforce an exhaustive-deps list, and including `draft`/`onSearchChange`
  // here would defeat the point (every keystroke would re-sync from the
  // parent before the debounce timer below ever fires).
  useEffect(() => {
    setDraft(searchValue);
  }, [searchValue]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== searchValue) onSearchChange(draft);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, onSearchChange, searchValue]);

  return (
    <div className="admin-resource-toolbar">
      <Form.Control
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder={searchPlaceholder}
        aria-label="Search"
        className="admin-resource-toolbar__search"
      />
      {onStatusChange && (
        <Form.Select
          value={statusValue ?? ''}
          onChange={(event) => onStatusChange(event.target.value || undefined)}
          aria-label="Filter by status"
          className="admin-resource-toolbar__status"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </Form.Select>
      )}
      {newHref && (
        <Link href={newHref} className="btn btn-primary ms-auto">
          <span className="bi bi-plus-lg" aria-hidden="true" /> {newLabel}
        </Link>
      )}
    </div>
  );
}
