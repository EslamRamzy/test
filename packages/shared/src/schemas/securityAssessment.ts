import {
  ASSESSMENT_STATUSES,
  ASSESSMENT_TEST_RESULTS,
  ASSESSMENT_TEST_TYPES,
  FINDING_SEVERITIES,
  FINDING_STATUSES,
} from '../constants/security.js';
import { z } from 'zod';

/**
 * Security assessments, the 15-test checklist, and findings — all nested
 * under a project (`GET|POST /admin/projects/:id/assessments`, doc 03 §5).
 * `isPublic` on both the assessment and each finding never overrides the
 * "never public while an OPEN CRITICAL/HIGH finding exists" rule
 * (`NEVER_PUBLIC_WHILE_OPEN`, docs/architecture/05 §4) — that rule is
 * enforced in the service layer against the finding's actual `severity`/
 * `status`, not something a schema can express.
 */
export const securityAssessmentCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    scope: z.string().trim().max(2000).optional(),
    methodology: z.string().trim().max(5000).optional(),
    summary: z.string().trim().max(5000).optional(),
    status: z.enum(ASSESSMENT_STATUSES).optional(),
    isPublic: z.boolean().optional(),
    assessedAt: z.iso.datetime().optional(),
    retestedAt: z.iso.datetime().optional(),
  })
  .strict();
export type SecurityAssessmentCreateInput = z.infer<typeof securityAssessmentCreateSchema>;

export const securityAssessmentUpdateSchema = securityAssessmentCreateSchema.partial().strict();
export type SecurityAssessmentUpdateInput = z.infer<typeof securityAssessmentUpdateSchema>;

/**
 * `PUT /admin/assessments/:id/tests` — "upsert the 15-test checklist"
 * (doc 03 §5). An array rather than a `Record<AssessmentTestType, ...>`:
 * the checklist need not cover all 15 in one call (a `NOT_APPLICABLE`
 * result can simply be omitted rather than resent every time), and
 * `@@unique([assessmentId, testType])` is what the repository's upsert
 * keys off, not array position.
 */
export const securityAssessmentTestInputSchema = z
  .object({
    testType: z.enum(ASSESSMENT_TEST_TYPES),
    result: z.enum(ASSESSMENT_TEST_RESULTS).optional(),
    notes: z.string().trim().max(2000).optional(),
    displayOrder: z.number().int().min(0).optional(),
  })
  .strict();
export const securityAssessmentTestsUpsertSchema = z
  .array(securityAssessmentTestInputSchema)
  .max(ASSESSMENT_TEST_TYPES.length);
export type SecurityAssessmentTestsUpsertInput = z.infer<
  typeof securityAssessmentTestsUpsertSchema
>;

export const securityFindingCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    severity: z.enum(FINDING_SEVERITIES),
    description: z.string().trim().max(10_000).optional(),
    impact: z.string().trim().max(5000).optional(),
    affectedComponent: z.string().trim().max(300).optional(),
    remediation: z.string().trim().max(5000).optional(),
    status: z.enum(FINDING_STATUSES).optional(),
    cweId: z.string().trim().max(20).optional(),
    isPublic: z.boolean().optional(),
    discoveredAt: z.iso.datetime().optional(),
    resolvedAt: z.iso.datetime().optional(),
  })
  .strict();
export type SecurityFindingCreateInput = z.infer<typeof securityFindingCreateSchema>;

export const securityFindingUpdateSchema = securityFindingCreateSchema.partial().strict();
export type SecurityFindingUpdateInput = z.infer<typeof securityFindingUpdateSchema>;
