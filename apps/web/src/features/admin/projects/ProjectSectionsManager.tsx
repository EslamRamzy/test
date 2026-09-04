'use client';

import type { ProjectAdminRow } from '@portfolio/shared';
import { useEffect, useState } from 'react';
import { useToast } from '@/features/admin/components/ToastProvider';
import { useUpdateProjectSections, type ProjectSectionEntryInput } from './client';

/** Matches `projectRepository.ts`'s `BUILT_IN_SECTION_KEYS` and `projectService.ts`'s `BUILT_IN_SECTION_TITLES` exactly — the frontend's own copy of the same fixed list, since the public renderer (not doc02's prose) is the ground truth for which keys are built-ins. */
const BUILT_IN_SECTION_TITLES: Record<string, string> = {
  problem: 'The Problem',
  solution: 'The Solution',
  architecture: 'Architecture',
  challenges: 'Challenges',
  solutionsDetail: 'How It Was Solved',
  lessonsLearned: 'Lessons Learned',
  deploymentNotes: 'Deployment Notes',
};
const BUILT_IN_SECTION_KEYS = Object.keys(BUILT_IN_SECTION_TITLES);

interface SectionEntry {
  sectionKey: string;
  title: string;
  body: string;
  visible: boolean;
  isCustom: boolean;
}

/**
 * `visibleSectionsJson` only ever lists VISIBLE keys, in order (D5's own
 * comment: "the single source of truth for what renders and in what
 * order") — a hidden section (built-in or custom) has no persisted order
 * anywhere, so it's simply appended after every visible one, in a fixed
 * fallback order, until the admin shows and reorders it again.
 */
export function buildInitialEntries(row: ProjectAdminRow): SectionEntry[] {
  let visibleKeys: string[] = [];
  try {
    const parsed: unknown = JSON.parse(row.visibleSectionsJson);
    if (Array.isArray(parsed)) visibleKeys = parsed.filter((key) => typeof key === 'string');
  } catch {
    visibleKeys = [];
  }

  const customByKey = new Map(row.sections.map((section) => [section.sectionKey, section]));
  const allKeys = [...BUILT_IN_SECTION_KEYS, ...row.sections.map((section) => section.sectionKey)];

  function toEntry(key: string): SectionEntry {
    const isCustom = !BUILT_IN_SECTION_KEYS.includes(key);
    const custom = customByKey.get(key);
    return {
      sectionKey: key,
      title: isCustom ? (custom?.title ?? key) : (BUILT_IN_SECTION_TITLES[key] ?? key),
      body: custom?.body ?? '',
      visible: visibleKeys.includes(key),
      isCustom,
    };
  }

  const visible = visibleKeys.filter((key) => allKeys.includes(key)).map(toEntry);
  const hidden = allKeys.filter((key) => !visibleKeys.includes(key)).map(toEntry);
  return [...visible, ...hidden];
}

export function ProjectSectionsManager({
  project,
}: {
  project: ProjectAdminRow;
}): React.JSX.Element {
  const { show } = useToast();
  const [entries, setEntries] = useState<SectionEntry[]>(() => buildInitialEntries(project));
  const [newKey, setNewKey] = useState('');
  const updateSections = useUpdateProjectSections();

  useEffect(() => {
    setEntries(buildInitialEntries(project));
  }, [project]);

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= entries.length) return;
    const reordered = [...entries];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved as SectionEntry);
    setEntries(reordered);
  }

  function toggleVisible(index: number): void {
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, visible: !entry.visible } : entry)),
    );
  }

  function updateCustomField(index: number, field: 'title' | 'body', value: string): void {
    setEntries((current) =>
      current.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)),
    );
  }

  function removeCustom(index: number): void {
    setEntries((current) => current.filter((_entry, i) => i !== index));
  }

  function addCustomSection(): void {
    const key = newKey.trim();
    if (!key) return;
    if (entries.some((entry) => entry.sectionKey === key)) {
      show({ message: `A section with the key "${key}" already exists.`, variant: 'danger' });
      return;
    }
    setEntries((current) => [
      ...current,
      { sectionKey: key, title: key, body: '', visible: false, isCustom: true },
    ]);
    setNewKey('');
  }

  function handleSave(): void {
    const payload: ProjectSectionEntryInput[] = entries.map((entry, index) => ({
      sectionKey: entry.sectionKey,
      ...(entry.isCustom ? { title: entry.title, body: entry.body } : {}),
      visible: entry.visible,
      displayOrder: index,
    }));
    updateSections.mutate(
      { id: project.id, entries: payload },
      {
        onSuccess: () => show({ message: 'Section order saved.', variant: 'success' }),
        onError: () => show({ message: 'Couldn’t save the section order.', variant: 'danger' }),
      },
    );
  }

  return (
    <div className="admin-sections-manager">
      <h2 className="h6 text-uppercase text-body-secondary mb-3">Section order &amp; visibility</h2>
      <ul className="admin-sortable-list">
        {entries.map((entry, index) => (
          <li className="admin-sortable-list__item" key={entry.sectionKey}>
            <div className="admin-sortable-list__controls">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${entry.title} up`}
              >
                <span className="bi bi-chevron-up" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === entries.length - 1}
                aria-label={`Move ${entry.title} down`}
              >
                <span className="bi bi-chevron-down" aria-hidden="true" />
              </button>
            </div>
            <div className="admin-sortable-list__content flex-grow-1">
              <div className="form-check form-switch mb-1">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id={`section-visible-${entry.sectionKey}`}
                  checked={entry.visible}
                  onChange={() => toggleVisible(index)}
                />
                <label
                  className="form-check-label fw-semibold"
                  htmlFor={`section-visible-${entry.sectionKey}`}
                >
                  {entry.isCustom ? entry.title : entry.title}{' '}
                  {!entry.isCustom && <span className="text-body-secondary">(built-in)</span>}
                </label>
              </div>
              {entry.isCustom && (
                <div className="d-flex flex-column gap-2 mt-2">
                  <input
                    className="form-control form-control-sm"
                    value={entry.title}
                    onChange={(event) => updateCustomField(index, 'title', event.target.value)}
                    aria-label={`${entry.sectionKey} title`}
                    placeholder="Section title"
                  />
                  <textarea
                    className="form-control form-control-sm"
                    rows={3}
                    value={entry.body}
                    onChange={(event) => updateCustomField(index, 'body', event.target.value)}
                    aria-label={`${entry.sectionKey} body`}
                    placeholder="Section body"
                  />
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger align-self-start"
                    onClick={() => removeCustom(index)}
                  >
                    Remove section
                  </button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <div className="input-group mb-3" style={{ maxWidth: '28rem' }}>
        <input
          className="form-control"
          placeholder="New custom section key, e.g. methodology"
          value={newKey}
          onChange={(event) => setNewKey(event.target.value)}
          aria-label="New custom section key"
        />
        <button type="button" className="btn btn-outline-secondary" onClick={addCustomSection}>
          <span className="bi bi-plus-lg" aria-hidden="true" /> Add section
        </button>
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSave}
        disabled={updateSections.isPending}
      >
        {updateSections.isPending ? 'Saving…' : 'Save section order'}
      </button>
    </div>
  );
}
