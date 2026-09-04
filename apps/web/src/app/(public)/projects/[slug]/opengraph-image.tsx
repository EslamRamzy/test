import { ImageResponse } from 'next/og';
import { getProject } from '@/lib/api/endpoints';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Generated from the row (docs/architecture/06 §8) — every share card is
 * correct without manual asset work, because it IS the project's own
 * title/description, not a static placeholder image someone forgot to
 * update.
 */
export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const project = await getProject(slug);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '80px',
        backgroundColor: '#0d0f14',
        color: '#e8eaf0',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={{ fontSize: 28, color: '#6b93ff', marginBottom: 24, display: 'flex' }}>
        Project
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.2, display: 'flex' }}>
        {project?.title ?? 'Project not found'}
      </div>
      {project && (
        <div style={{ fontSize: 30, color: '#9aa3b2', marginTop: 24, display: 'flex' }}>
          {project.shortDescription}
        </div>
      )}
    </div>,
    size,
  );
}
