import type { CertificationDto } from '@portfolio/shared';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import * as certificationRepository from '../repositories/certificationRepository.js';
import { findVisible } from '../repositories/certificationRepository.js';
import { createAdminCrudService } from './adminCrudFactory.js';

export async function listCertifications(): Promise<CertificationDto[]> {
  const rows = await findVisible();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    description: row.description,
    certificateMedia: toPublicMediaRefOrNull(row.certificateMedia),
    credentialUrl: row.credentialUrl,
    issueDate: row.issueDate ? row.issueDate.toISOString() : null,
    expirationDate: row.expirationDate ? row.expirationDate.toISOString() : null,
  }));
}

// --- Admin CRUD (docs/architecture/03 §5) -----------------------------------

type CertificationRow = NonNullable<Awaited<ReturnType<typeof certificationRepository.findById>>>;

export const certificationAdminService = createAdminCrudService<
  CertificationRow,
  Parameters<typeof certificationRepository.create>[0],
  Parameters<typeof certificationRepository.update>[1],
  certificationRepository.CertificationListParams
>({
  entityName: 'CERTIFICATION',
  repository: certificationRepository,
  getRowId: (row) => row.id,
});
