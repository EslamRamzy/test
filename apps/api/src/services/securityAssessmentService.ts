import type {
  SecurityAssessmentCreateInput,
  SecurityAssessmentTestsUpsertInput,
  SecurityAssessmentUpdateInput,
  SecurityFindingCreateInput,
  SecurityFindingUpdateInput,
} from '@portfolio/shared';
import { NEVER_PUBLIC_WHILE_OPEN } from '@portfolio/shared';
import { prisma } from '../config/prisma.js';
import { NotFoundError, ValidationError } from '../errors/AppError.js';
import { revalidateTags } from '../lib/revalidate.js';
import * as projectRepository from '../repositories/projectRepository.js';
import * as assessmentRepository from '../repositories/securityAssessmentRepository.js';
import type { SecurityAssessmentAdminRow } from '../repositories/securityAssessmentRepository.js';
import * as auditLogRepository from '../repositories/auditLogRepository.js';
import type { AdminCrudActor } from './adminCrudFactory.js';

/**
 * Security assessments, the 15-test checklist, and findings — doc03 §5's
 * own nested-under-a-project group. Hand-written (same reasoning as every
 * other publish-workflow-adjacent service): the never-public-while-open
 * guard below and the revalidation lookups don't fit the generic factory.
 */

async function revalidateProject(projectId: number): Promise<void> {
  const project = await projectRepository.findByIdForAdmin(projectId);
  // Should never be null — a finding/assessment's own FK guarantees the
  // project exists — but this is a best-effort side call, never worth
  // failing the mutation that already committed over.
  if (project && project.status === 'PUBLISHED') {
    await revalidateTags(['projects', `project:${project.slug}`]);
  }
}

export async function listAssessments(projectId: number): Promise<SecurityAssessmentAdminRow[]> {
  const project = await projectRepository.findByIdForAdmin(projectId);
  if (!project) throw new NotFoundError('Project not found');
  return assessmentRepository.listForProject(projectId);
}

export async function createAssessment(
  projectId: number,
  data: SecurityAssessmentCreateInput,
  actor: AdminCrudActor,
): Promise<SecurityAssessmentAdminRow> {
  const project = await projectRepository.findByIdForAdmin(projectId);
  if (!project) throw new NotFoundError('Project not found');

  const row = await prisma.$transaction(async (tx) => {
    const created = await assessmentRepository.create(projectId, data, tx);
    await auditLogRepository.record(
      {
        userId: actor.id,
        action: 'ASSESSMENT_CREATE',
        entityType: 'ASSESSMENT',
        entityId: created.id,
      },
      tx,
    );
    return created;
  });

  if (project.status === 'PUBLISHED') {
    await revalidateTags(['projects', `project:${project.slug}`]);
  }
  return row;
}

export async function getAssessmentForAdmin(id: number): Promise<SecurityAssessmentAdminRow> {
  const row = await assessmentRepository.findByIdForAdmin(id);
  if (!row) throw new NotFoundError('Security assessment not found');
  return row;
}

export async function updateAssessment(
  id: number,
  data: SecurityAssessmentUpdateInput,
  actor: AdminCrudActor,
): Promise<SecurityAssessmentAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await assessmentRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Security assessment not found');
    const updated = await assessmentRepository.update(id, data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'ASSESSMENT_UPDATE', entityType: 'ASSESSMENT', entityId: id },
      tx,
    );
    return updated;
  });

  await revalidateProject(row.projectId);
  return row;
}

export async function removeAssessment(id: number, actor: AdminCrudActor): Promise<void> {
  const projectId = await prisma.$transaction(async (tx) => {
    const existing = await assessmentRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Security assessment not found');
    await assessmentRepository.remove(id, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'ASSESSMENT_DELETE', entityType: 'ASSESSMENT', entityId: id },
      tx,
    );
    return existing.projectId;
  });

  await revalidateProject(projectId);
}

export async function upsertAssessmentTests(
  id: number,
  tests: SecurityAssessmentTestsUpsertInput,
  actor: AdminCrudActor,
): Promise<SecurityAssessmentAdminRow> {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await assessmentRepository.findByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Security assessment not found');
    const updated = await assessmentRepository.upsertTests(id, tests, tx);
    await auditLogRepository.record(
      {
        userId: actor.id,
        action: 'ASSESSMENT_TESTS_UPSERT',
        entityType: 'ASSESSMENT',
        entityId: id,
      },
      tx,
    );
    return updated;
  });

  const updated = row as SecurityAssessmentAdminRow;
  await revalidateProject(updated.projectId);
  return updated;
}

// --- Findings ----------------------------------------------------------------

/**
 * Doc10 §3's named "Findings safety" case: "attempting to publish an OPEN +
 * CRITICAL finding → rejected." This is a write-time rejection, IN ADDITION
 * to (not instead of) the read-time filter `projectRepository.ts`'s public
 * select already applies (`schema.prisma`'s own comment on `isPublic`: "this
 * flag alone does not make a CRITICAL/HIGH open finding visible") — belt and
 * suspenders on the same invariant, enforced at both the write and the read.
 * Computed against the EFFECTIVE severity/status/isPublic (existing values
 * merged with whatever the patch actually changes), not just the patch in
 * isolation, so `PATCH { isPublic: true }` alone on an already-OPEN-CRITICAL
 * finding is caught too, not only a single call that sets all three at once.
 */
function checkNeverPublicWhileOpen(
  severity: string,
  status: string,
  isPublic: boolean,
  fieldErrors: { field: string; message: string }[],
): void {
  if (isPublic && NEVER_PUBLIC_WHILE_OPEN.includes(severity as never) && status === 'OPEN') {
    fieldErrors.push({
      field: 'isPublic',
      message: 'An open CRITICAL or HIGH finding cannot be made public — resolve it first',
    });
  }
}

export async function listFindings(assessmentId: number) {
  const assessment = await assessmentRepository.findByIdForAdmin(assessmentId);
  if (!assessment) throw new NotFoundError('Security assessment not found');
  return assessmentRepository.listFindings(assessmentId);
}

export async function createFinding(
  assessmentId: number,
  data: SecurityFindingCreateInput,
  actor: AdminCrudActor,
) {
  const assessment = await assessmentRepository.findByIdForAdmin(assessmentId);
  if (!assessment) throw new NotFoundError('Security assessment not found');

  const errors: { field: string; message: string }[] = [];
  checkNeverPublicWhileOpen(data.severity, data.status ?? 'OPEN', data.isPublic ?? false, errors);
  if (errors.length > 0) throw new ValidationError(errors);

  const row = await prisma.$transaction(async (tx) => {
    const created = await assessmentRepository.createFinding(assessmentId, data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'FINDING_CREATE', entityType: 'FINDING', entityId: created.id },
      tx,
    );
    return created;
  });

  await revalidateProject(assessment.projectId);
  return row;
}

export async function updateFinding(
  id: number,
  data: SecurityFindingUpdateInput,
  actor: AdminCrudActor,
) {
  const row = await prisma.$transaction(async (tx) => {
    const existing = await assessmentRepository.findFindingByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Finding not found');

    const errors: { field: string; message: string }[] = [];
    checkNeverPublicWhileOpen(
      data.severity ?? existing.severity,
      data.status ?? existing.status,
      data.isPublic ?? existing.isPublic,
      errors,
    );
    if (errors.length > 0) throw new ValidationError(errors);

    const updated = await assessmentRepository.updateFinding(id, data, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'FINDING_UPDATE', entityType: 'FINDING', entityId: id },
      tx,
    );
    return { updated, projectId: existing.assessment.projectId };
  });

  await revalidateProject(row.projectId);
  return row.updated;
}

export async function removeFinding(id: number, actor: AdminCrudActor): Promise<void> {
  const projectId = await prisma.$transaction(async (tx) => {
    const existing = await assessmentRepository.findFindingByIdForAdmin(id, tx);
    if (!existing) throw new NotFoundError('Finding not found');
    await assessmentRepository.removeFinding(id, tx);
    await auditLogRepository.record(
      { userId: actor.id, action: 'FINDING_DELETE', entityType: 'FINDING', entityId: id },
      tx,
    );
    return existing.assessment.projectId;
  });

  await revalidateProject(projectId);
}
