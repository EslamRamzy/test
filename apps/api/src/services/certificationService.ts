import type { CertificationDto } from '@portfolio/shared';
import { toPublicMediaRefOrNull } from '../lib/mediaUrl.js';
import { findVisible } from '../repositories/certificationRepository.js';

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
