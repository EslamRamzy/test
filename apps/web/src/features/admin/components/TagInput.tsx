'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createAdminResourceClient } from '@/lib/api/adminResource';
import { slugify } from '../lib/slugify';
import { useToast } from './ToastProvider';

/**
 * `<TagInput>` — "Create-or-select against `/tags`" (doc07 §2). Reused by
 * Articles and Security Research alike (`tag.ts`'s own schema comment:
 * "Reused by both Articles and Security Research"), so this lives here as
 * a shared building block rather than inside either module.
 */
export interface TagOption {
  id: number;
  name: string;
  slug: string;
}

const tagsClient = createAdminResourceClient<TagOption>('/api/v1/admin/tags');

export interface TagInputProps {
  value: TagOption[];
  onChange: (tags: TagOption[]) => void;
  disabled?: boolean;
}

export function TagInput({ value, onChange, disabled = false }: TagInputProps): React.JSX.Element {
  const { show } = useToast();
  const [inputValue, setInputValue] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(inputValue.trim()), 250);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const { data } = useQuery({
    queryKey: ['admin', 'tags', 'search', debounced],
    queryFn: () => tagsClient.list({ q: debounced, pageSize: 10 }),
    enabled: debounced.length > 0,
  });

  const selectedIds = useMemo(() => new Set(value.map((tag) => tag.id)), [value]);
  const suggestions = (data?.items ?? []).filter((tag) => !selectedIds.has(tag.id));

  function addTag(tag: TagOption): void {
    onChange([...value, tag]);
    setInputValue('');
    setDebounced('');
  }

  function removeTag(id: number): void {
    onChange(value.filter((tag) => tag.id !== id));
  }

  async function createAndAddTag(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed) return;

    // An exact-name match already on the suggestion list reuses the
    // existing row instead of racing a duplicate create against the
    // server's own unique constraint on `name`.
    const existing = suggestions.find((tag) => tag.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      addTag(existing);
      return;
    }

    try {
      const created = await tagsClient.create({ name: trimmed, slug: slugify(trimmed) });
      addTag(created);
    } catch (error) {
      show({
        message: error instanceof Error ? error.message : 'Could not create the tag',
        variant: 'danger',
      });
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      void createAndAddTag(inputValue);
    }
  }

  return (
    <div className="admin-tag-input">
      <div className="admin-tag-input__pills">
        {value.map((tag) => (
          <span key={tag.id} className="admin-tag-input__pill">
            {tag.name}
            <button
              type="button"
              className="admin-tag-input__remove"
              onClick={() => removeTag(tag.id)}
              aria-label={`Remove tag ${tag.name}`}
              disabled={disabled}
            >
              &times;
            </button>
          </span>
        ))}
        <input
          type="text"
          className="admin-tag-input__field"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Add a tag…"
          disabled={disabled}
          aria-label="Add a tag"
        />
      </div>
      {inputValue.length > 0 && suggestions.length > 0 && (
        <ul className="admin-tag-input__suggestions" role="listbox" aria-label="Matching tags">
          {suggestions.map((tag) => (
            <li key={tag.id}>
              <button type="button" onClick={() => addTag(tag)} role="option" aria-selected="false">
                {tag.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
