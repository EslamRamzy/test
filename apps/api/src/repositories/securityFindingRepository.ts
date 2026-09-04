import { prisma } from '../config/prisma.js';

/**
 * Deliberately minimal — the full CRUD surface for security findings
 * (`GET|POST /admin/projects/:id/assessments`, `PATCH|DELETE /admin/findings/:id`
 * etc., docs/architecture/03 §3) belongs to Phase 8 ("admin CRUD for all 13
 * modules"). This file exists now only for the one admin-dashboard counter
 * Phase 7 needs — everything else about findings is still unimplemented.
 */

/** Admin dashboard counter: findings still open, regardless of severity. `ForAdmin`-suffixed (docs/architecture/05 §5). */
export function countOpenForAdmin() {
  return prisma.securityFinding.count({ where: { status: 'OPEN' } });
}
