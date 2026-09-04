import type { ProjectAdminRow } from '@portfolio/shared';
import { describe, expect, it } from 'vitest';
import { buildInitialEntries } from './ProjectSectionsManager';

function fakeProject(overrides: Partial<ProjectAdminRow> = {}): ProjectAdminRow {
  return {
    id: 1,
    visibleSectionsJson: '[]',
    sections: [],
    ...overrides,
  } as ProjectAdminRow;
}

describe('buildInitialEntries', () => {
  it('lists visible built-in sections first, in visibleSectionsJson order, then the rest hidden', () => {
    const project = fakeProject({ visibleSectionsJson: JSON.stringify(['solution', 'problem']) });
    const entries = buildInitialEntries(project);

    expect(entries[0]).toMatchObject({ sectionKey: 'solution', visible: true, isCustom: false });
    expect(entries[1]).toMatchObject({ sectionKey: 'problem', visible: true, isCustom: false });
    // The other 5 built-ins follow, all hidden.
    expect(entries.slice(2)).toHaveLength(5);
    expect(entries.slice(2).every((entry) => !entry.visible)).toBe(true);
  });

  it('includes a custom section with its own title and body, from row.sections', () => {
    const project = fakeProject({
      visibleSectionsJson: JSON.stringify(['methodology']),
      sections: [
        {
          id: 1,
          projectId: 1,
          sectionKey: 'methodology',
          title: 'Methodology',
          body: 'How the assessment was run.',
          displayOrder: 0,
          visible: true,
        },
      ],
    });
    const entries = buildInitialEntries(project);

    const custom = entries.find((entry) => entry.sectionKey === 'methodology');
    expect(custom).toMatchObject({
      title: 'Methodology',
      body: 'How the assessment was run.',
      visible: true,
      isCustom: true,
    });
  });

  it('gives a built-in section its fixed display title', () => {
    const project = fakeProject({ visibleSectionsJson: JSON.stringify(['deploymentNotes']) });
    const entries = buildInitialEntries(project);
    expect(entries[0]).toMatchObject({ sectionKey: 'deploymentNotes', title: 'Deployment Notes' });
  });

  it('lists a hidden custom section (not in visibleSectionsJson) after every visible one', () => {
    const project = fakeProject({
      visibleSectionsJson: JSON.stringify(['problem']),
      sections: [
        {
          id: 2,
          projectId: 1,
          sectionKey: 'threat-model',
          title: 'Threat Model',
          body: null,
          displayOrder: 0,
          visible: false,
        },
      ],
    });
    const entries = buildInitialEntries(project);
    const index = entries.findIndex((entry) => entry.sectionKey === 'threat-model');
    expect(index).toBeGreaterThan(0);
    expect(entries[index]).toMatchObject({ visible: false, isCustom: true, title: 'Threat Model' });
  });
});
