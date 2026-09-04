import { ImageResponse } from 'next/og';
import { getArticle } from '@/lib/api/endpoints';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getArticle(slug);

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
        Article
      </div>
      <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.2, display: 'flex' }}>
        {result?.title ?? 'Article not found'}
      </div>
      {result?.excerpt && (
        <div style={{ fontSize: 30, color: '#9aa3b2', marginTop: 24, display: 'flex' }}>
          {result.excerpt}
        </div>
      )}
    </div>,
    size,
  );
}
