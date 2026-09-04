import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/config/prisma.js';

/**
 * D5 ("hybrid case-study body"): `visibleSectionsJson` is the single source
 * of truth for which sections render and in what order — a key naming a
 * built-in `projects` column reads that column; any other key reads its
 * `ProjectSection` row. See `services/projectService.ts`'s
 * `buildVisibleSections`.
 */

const app = createApp();
const createdProjectIds: number[] = [];

async function createProject(visibleSectionsJson: string) {
  const slug = `sections-test-${randomUUID()}`;
  const project = await prisma.project.create({
    data: {
      title: 'Section Ordering Test',
      slug,
      shortDescription: 'A short description used only in tests.',
      category: 'WEB_APP',
      status: 'PUBLISHED',
      publishedAt: new Date(),
      problem: 'The problem body.',
      solution: 'The solution body.',
      architecture: null, // built-in column with no content
      visibleSectionsJson,
    },
  });
  createdProjectIds.push(project.id);
  return { project, slug };
}

afterAll(async () => {
  if (createdProjectIds.length) {
    await prisma.project.deleteMany({ where: { id: { in: createdProjectIds } } });
  }
});

async function getSections(slug: string) {
  const res = await request(app).get(`/api/v1/projects/${slug}`);
  const body = res.body as {
    data: { sections: Array<{ key: string; title: string; body: string | null }> };
  };
  return body.data.sections;
}

describe('project section visibility (D5)', () => {
  it('includes a built-in column key with its real content when listed', async () => {
    const { slug } = await createProject(JSON.stringify(['problem']));
    const sections = await getSections(slug);
    expect(sections).toEqual([{ key: 'problem', title: 'The Problem', body: 'The problem body.' }]);
  });

  it('excludes a built-in column NOT listed in visibleSectionsJson, even though it has content', async () => {
    const { slug } = await createProject(JSON.stringify(['problem'])); // solution has content but is not listed
    const sections = await getSections(slug);
    expect(sections.some((s) => s.key === 'solution')).toBe(false);
  });

  it('skips a listed built-in key whose column is empty', async () => {
    const { slug } = await createProject(JSON.stringify(['architecture'])); // architecture is null
    const sections = await getSections(slug);
    expect(sections).toEqual([]);
  });

  it('respects the order given in visibleSectionsJson', async () => {
    const { slug } = await createProject(JSON.stringify(['solution', 'problem']));
    const sections = await getSections(slug);
    expect(sections.map((s) => s.key)).toEqual(['solution', 'problem']);
  });

  it('reads a custom key from its ProjectSection row, not a column', async () => {
    const { project, slug } = await createProject(JSON.stringify(['custom-notes']));
    await prisma.projectSection.create({
      data: {
        projectId: project.id,
        sectionKey: 'custom-notes',
        title: 'Extra Notes',
        body: 'Custom section body.',
        visible: true,
      },
    });
    const sections = await getSections(slug);
    expect(sections).toEqual([
      { key: 'custom-notes', title: 'Extra Notes', body: 'Custom section body.' },
    ]);
  });

  it('skips a custom section row that is marked not visible', async () => {
    const { project, slug } = await createProject(JSON.stringify(['hidden-notes']));
    await prisma.projectSection.create({
      data: {
        projectId: project.id,
        sectionKey: 'hidden-notes',
        title: 'Hidden Notes',
        body: 'Should not appear.',
        visible: false,
      },
    });
    const sections = await getSections(slug);
    expect(sections).toEqual([]);
  });

  it('silently skips a key with no matching built-in column or custom section (no crash)', async () => {
    const { slug } = await createProject(JSON.stringify(['this-key-does-not-exist-anywhere']));
    const res = await request(app).get(`/api/v1/projects/${slug}`);
    expect(res.status).toBe(200);
    const sections = await getSections(slug);
    expect(sections).toEqual([]);
  });

  it('degrades to no sections on malformed JSON rather than 500ing', async () => {
    const { slug } = await createProject('not valid json{{{');
    const res = await request(app).get(`/api/v1/projects/${slug}`);
    expect(res.status).toBe(200);
    const sections = await getSections(slug);
    expect(sections).toEqual([]);
  });
});
