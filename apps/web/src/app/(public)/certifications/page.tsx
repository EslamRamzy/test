import type { Metadata } from 'next';
import { listCertifications } from '@/lib/api/endpoints';
import { PublicMediaImage } from '@/components/ui/PublicMediaImage';
import { formatDate } from '@/lib/utils/formatDate';

export const metadata: Metadata = {
  title: 'Certifications',
  description: 'Professional certifications and credentials.',
};

export default async function CertificationsPage() {
  const certifications = await listCertifications();

  return (
    <div className="container py-5">
      <h1 className="h2 mb-4">Certifications</h1>

      {certifications.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>No certifications listed yet.</p>
      ) : (
        <div className="row g-4">
          {certifications.map((cert) => (
            <div className="col-md-6 col-lg-4" key={cert.id}>
              <div className="card h-100">
                {cert.certificateMedia && (
                  <div className="ratio ratio-4x3">
                    <PublicMediaImage
                      media={cert.certificateMedia}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="card-img-top object-fit-cover"
                    />
                  </div>
                )}
                <div className="card-body">
                  <h2 className="h5">{cert.name}</h2>
                  <p className="mb-2" style={{ color: 'var(--color-text-muted)' }}>
                    {cert.issuer}
                  </p>
                  {cert.description && <p className="mb-2">{cert.description}</p>}
                  {cert.issueDate && (
                    <p className="mb-2 small" style={{ color: 'var(--color-text-muted)' }}>
                      Issued {formatDate(cert.issueDate)}
                      {cert.expirationDate && ` · Expires ${formatDate(cert.expirationDate)}`}
                    </p>
                  )}
                  {cert.credentialUrl && (
                    <a
                      href={cert.credentialUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-primary small"
                    >
                      Verify credential{' '}
                      <span className="bi bi-box-arrow-up-right" aria-hidden="true" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
