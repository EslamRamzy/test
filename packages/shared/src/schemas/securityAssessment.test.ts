import { describe, expect, it } from 'vitest';
import {
  securityAssessmentCreateSchema,
  securityAssessmentTestsUpsertSchema,
  securityFindingCreateSchema,
} from './securityAssessment.js';

describe('securityAssessmentCreateSchema', () => {
  it('accepts a minimal assessment and rejects an invalid status', () => {
    expect(securityAssessmentCreateSchema.safeParse({ title: 'Q1 pentest' }).success).toBe(true);
    expect(
      securityAssessmentCreateSchema.safeParse({ title: 'Q1 pentest', status: 'DONE' }).success,
    ).toBe(false);
  });
});

describe('securityAssessmentTestsUpsertSchema', () => {
  it('accepts a partial checklist (not all 15 tests need to be sent every time)', () => {
    const result = securityAssessmentTestsUpsertSchema.safeParse([
      { testType: 'IDOR', result: 'ISSUES_FOUND', notes: 'Found 2 IDORs in /projects/:id' },
      { testType: 'XSS', result: 'PASS' },
    ]);
    expect(result.success).toBe(true);
  });

  it('rejects an unknown test type', () => {
    expect(
      securityAssessmentTestsUpsertSchema.safeParse([{ testType: 'CLICKJACKING' }]).success,
    ).toBe(false);
  });

  it('rejects more entries than the fixed 15-test vocabulary has', () => {
    const tooMany = Array.from({ length: 16 }, () => ({ testType: 'XSS' as const }));
    expect(securityAssessmentTestsUpsertSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe('securityFindingCreateSchema', () => {
  it('requires title and severity', () => {
    expect(securityFindingCreateSchema.safeParse({ title: 'Stored XSS' }).success).toBe(false);
    expect(
      securityFindingCreateSchema.safeParse({ title: 'Stored XSS', severity: 'HIGH' }).success,
    ).toBe(true);
  });

  it('rejects an invalid severity', () => {
    expect(securityFindingCreateSchema.safeParse({ title: 'x', severity: 'EXTREME' }).success).toBe(
      false,
    );
  });
});
