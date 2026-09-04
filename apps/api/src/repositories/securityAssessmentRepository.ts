import type {
  SecurityAssessmentCreateInput,
  SecurityAssessmentTestsUpsertInput,
  SecurityAssessmentUpdateInput,
  SecurityFindingCreateInput,
  SecurityFindingUpdateInput,
} from '@portfolio/shared';
import type { Prisma } from '../../generated/prisma/client.js';
import { prisma } from '../config/prisma.js';
import type { PrismaClientOrTx } from '../config/prisma.js';
import { stripUndefined } from '../lib/stripUndefined.js';

/**
 * Security assessments, the 15-test checklist, and findings — all nested
 * under a project (doc03 §5), admin-only (there is no public repository
 * here at all: the public project detail already reads assessments/
 * findings directly off `Project.assessments` in `projectRepository.ts`'s
 * own `PUBLIC_PROJECT_DETAIL_SELECT`, filtered to `isPublic` rows there —
 * this file is the write side only).
 */

const ADMIN_INCLUDE = {
  tests: { orderBy: { displayOrder: 'asc' as const } },
  findings: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.SecurityAssessmentInclude;

export type SecurityAssessmentAdminRow = Prisma.SecurityAssessmentGetPayload<{
  include: typeof ADMIN_INCLUDE;
}>;

export function listForProject(projectId: number, client: PrismaClientOrTx = prisma) {
  return client.securityAssessment.findMany({
    where: { projectId },
    include: ADMIN_INCLUDE,
    orderBy: { id: 'asc' },
  });
}

export function findByIdForAdmin(id: number, client: PrismaClientOrTx = prisma) {
  return client.securityAssessment.findUnique({ where: { id }, include: ADMIN_INCLUDE });
}

export function create(
  projectId: number,
  data: SecurityAssessmentCreateInput,
  client: PrismaClientOrTx = prisma,
) {
  return client.securityAssessment.create({
    data: { projectId, ...stripUndefined(data) },
    include: ADMIN_INCLUDE,
  });
}

export function update(
  id: number,
  data: SecurityAssessmentUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  return client.securityAssessment.update({
    where: { id },
    data: stripUndefined(data),
    include: ADMIN_INCLUDE,
  });
}

export async function remove(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.securityAssessment.delete({ where: { id } });
}

/**
 * `PUT /admin/assessments/:id/tests` — upserts each entry by the compound
 * `(assessmentId, testType)` key the schema comment describes; an entry
 * omitted from `tests` simply isn't touched (this is an upsert, not a
 * replace-the-whole-set — unlike `features`/`references` elsewhere, doc03
 * §5's own wording is "upsert," and a 15-item checklist has no "delete a
 * test type" concept to begin with).
 */
export async function upsertTests(
  assessmentId: number,
  tests: SecurityAssessmentTestsUpsertInput,
  client: PrismaClientOrTx = prisma,
) {
  for (const [index, test] of tests.entries()) {
    const { testType, ...rest } = test;
    await client.securityAssessmentTest.upsert({
      where: { assessmentId_testType: { assessmentId, testType } },
      create: {
        assessmentId,
        testType,
        ...stripUndefined({ ...rest, displayOrder: rest.displayOrder ?? index }),
      },
      update: stripUndefined(rest),
    });
  }
  return findByIdForAdmin(assessmentId, client);
}

// --- Findings ----------------------------------------------------------------

export function listFindings(assessmentId: number, client: PrismaClientOrTx = prisma) {
  return client.securityFinding.findMany({ where: { assessmentId }, orderBy: { id: 'asc' } });
}

/** Includes the parent assessment's `projectId` — the service needs it to check the project's publish status for revalidation, without a second query. */
export function findFindingByIdForAdmin(id: number, client: PrismaClientOrTx = prisma) {
  return client.securityFinding.findUnique({
    where: { id },
    include: { assessment: { select: { id: true, projectId: true } } },
  });
}

export function createFinding(
  assessmentId: number,
  data: SecurityFindingCreateInput,
  client: PrismaClientOrTx = prisma,
) {
  return client.securityFinding.create({ data: { assessmentId, ...stripUndefined(data) } });
}

export function updateFinding(
  id: number,
  data: SecurityFindingUpdateInput,
  client: PrismaClientOrTx = prisma,
) {
  return client.securityFinding.update({ where: { id }, data: stripUndefined(data) });
}

export async function removeFinding(id: number, client: PrismaClientOrTx = prisma): Promise<void> {
  await client.securityFinding.delete({ where: { id } });
}
