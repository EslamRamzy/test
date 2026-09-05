'use client';

import type { ProjectAdminRow } from '@portfolio/shared';
import { useState } from 'react';
import { MediaPicker } from '@/features/admin/components/MediaPicker';
import { useToast } from '@/features/admin/components/ToastProvider';
import { getApiBaseUrl } from '@/lib/config';
import { useAddProjectImage, useRemoveProjectImage, useReorderProjectImages } from './client';

function mediaUrl(filename: string): string {
  return `${getApiBaseUrl()}/uploads/${filename}`;
}

/**
 * `POST/DELETE/PATCH .../images*` (doc07 §3's Media tab) — the cover image
 * itself lives on the Overview tab (`coverMediaId`, part of the main
 * form); this panel is the gallery repeater, doc03 §5's own separate
 * per-image endpoints.
 */
export function ProjectMediaPanel({ project }: { project: ProjectAdminRow }): React.JSX.Element {
  const { show } = useToast();
  const [pendingMediaId, setPendingMediaId] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const addImage = useAddProjectImage();
  const removeImage = useRemoveProjectImage();
  const reorderImages = useReorderProjectImages();
  const images = project.images;

  function handleAdd(): void {
    if (!pendingMediaId) {
      show({ message: 'Choose an image first.', variant: 'danger' });
      return;
    }
    addImage.mutate(
      {
        id: project.id,
        mediaId: pendingMediaId,
        ...(caption.trim() ? { caption: caption.trim() } : {}),
      },
      {
        onSuccess: () => {
          show({ message: 'Image added.', variant: 'success' });
          setPendingMediaId(null);
          setCaption('');
        },
        onError: () => show({ message: 'Couldn’t add that image.', variant: 'danger' }),
      },
    );
  }

  function handleRemove(imageId: number): void {
    removeImage.mutate(
      { id: project.id, imageId },
      {
        onSuccess: () => show({ message: 'Image removed.', variant: 'success' }),
        onError: () => show({ message: 'Couldn’t remove that image.', variant: 'danger' }),
      },
    );
  }

  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const reordered = [...images];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved as (typeof images)[number]);
    reorderImages.mutate(
      {
        id: project.id,
        items: reordered.map((image, position) => ({ id: image.id, displayOrder: position })),
      },
      { onError: () => show({ message: 'Couldn’t save the new order.', variant: 'danger' }) },
    );
  }

  return (
    <div>
      <h2 className="h6 text-uppercase text-body-secondary mb-3">Gallery images</h2>
      {images.length === 0 ? (
        <p className="text-body-secondary">No gallery images yet.</p>
      ) : (
        <ul className="admin-sortable-list mb-3">
          {images.map((image, index) => (
            <li className="admin-sortable-list__item" key={image.id}>
              <div className="admin-sortable-list__controls">
                <button
                  type="button"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move image ${image.id} up`}
                >
                  <span className="bi bi-chevron-up" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, 1)}
                  disabled={index === images.length - 1}
                  aria-label={`Move image ${image.id} down`}
                >
                  <span className="bi bi-chevron-down" aria-hidden="true" />
                </button>
              </div>
              <div className="admin-sortable-list__content flex-grow-1 d-flex justify-content-between align-items-center gap-2">
                <span className="d-flex align-items-center gap-2">
                  <img
                    src={mediaUrl(image.media.filename)}
                    alt=""
                    width={40}
                    height={40}
                    style={{ objectFit: 'cover', borderRadius: 'var(--radius-sm)' }}
                  />
                  {image.caption ? ` — ${image.caption}` : ''}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleRemove(image.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="d-flex flex-wrap align-items-end gap-2">
        <MediaPicker
          value={pendingMediaId}
          onChange={setPendingMediaId}
          kind="SCREENSHOT"
          label="gallery image"
        />
        <input
          className="form-control"
          placeholder="Caption (optional)"
          value={caption}
          onChange={(event) => setCaption(event.target.value)}
          aria-label="New image caption"
          style={{ maxWidth: '16rem' }}
        />
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={handleAdd}
          disabled={addImage.isPending || !pendingMediaId}
        >
          Add to gallery
        </button>
      </div>
    </div>
  );
}
