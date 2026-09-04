/**
 * Security assessment vocabulary (docs/architecture/02 §3, brief §9).
 *
 * ASSESSMENT_TEST_TYPES is deliberately the exact 15-item list from the
 * requirements, so the platform's own security assessment can be recorded
 * against the same checklist it publishes.
 */

export const ASSESSMENT_TEST_TYPES = [
  'AUTHENTICATION',
  'AUTHORIZATION',
  'IDOR',
  'XSS',
  'SQL_INJECTION',
  'CSRF',
  'SSRF',
  'FILE_UPLOAD',
  'API_SECURITY',
  'JWT_SECURITY',
  'SESSION_MANAGEMENT',
  'RATE_LIMITING',
  'DEPENDENCY_SECURITY',
  'SECURITY_HEADERS',
  'BUSINESS_LOGIC',
] as const;
export type AssessmentTestType = (typeof ASSESSMENT_TEST_TYPES)[number];

export const ASSESSMENT_TEST_RESULTS = [
  'PASS',
  'ISSUES_FOUND',
  'NOT_APPLICABLE',
  'NOT_TESTED',
] as const;
export type AssessmentTestResult = (typeof ASSESSMENT_TEST_RESULTS)[number];

export const ASSESSMENT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'RETESTED'] as const;
export type AssessmentStatus = (typeof ASSESSMENT_STATUSES)[number];

export const FINDING_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'] as const;
export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];

export const FINDING_STATUSES = [
  'OPEN',
  'FIXED',
  'ACCEPTED_RISK',
  'FALSE_POSITIVE',
  'RETESTED',
] as const;
export type FindingStatus = (typeof FINDING_STATUSES)[number];

/**
 * Severities that must never be rendered publicly while the finding is OPEN.
 *
 * Publishing an unfixed critical vulnerability in your own live project is a
 * real-world risk, so this is enforced in the service layer regardless of the
 * is_public flags (docs/architecture/05 §4).
 */
export const NEVER_PUBLIC_WHILE_OPEN: readonly FindingSeverity[] = ['CRITICAL', 'HIGH'];
