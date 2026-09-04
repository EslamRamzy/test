'use client';

import type { ProjectAdminRow } from '@portfolio/shared';
import { useState } from 'react';
import { useToast } from '@/features/admin/components/ToastProvider';
import { useAddProjectImage, useRemoveProjectImage, useReorderProjectImages } from './client';

/**
 * `POST/DELETE/PATCH .../images*` (doc07 §3's Media tab) — the cover image
 * itself lives on the Overview tab (`coverMediaId`, part of the main
 * form); this panel is the gallery repeater, doc03 §5's own separate
 * per-image endpoints. No media picker (Phase 9) — same numeric-id stopgap
 * as `coverMediaId` everywhere else in this module.
 */
export function ProjectMediaPanel({ project }: { project: ProjectAdminRow }): React.JSX.Element {
  const { show } = useToast();
  const [mediaId, setMediaId] = useState('');
  const [caption, setCaption] = useState('');
  const addImage = useAddProjectImage();
  const removeImage = useRemoveProjectImage();
  const reorderImages = useReorderProjectImages();
  const images = project.images;

  function handleAdd(): void {
    const parsed = Number(mediaId);
    if (!mediaId.trim() || !Number.isInteger(parsed) || parsed <= 0) {
      show({ message: 'Enter a valid media id first.', variant: 'danger' });
      return;
    }
    addImage.mutate(
      { id: project.id, mediaId: parsed, ...(caption.trim() ? { caption: caption.trim() } : {}) },
      {
        onSuccess: () => {
          show({ message: 'Image added.', variant: 'success' });
          setMediaId('');
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
              <div className="admin-sortable-list__content flex-grow-1 d-flex justify-content-between align-items-center">
                <span>
                  Media #{image.mediaId}
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

      <div className="row g-2" style={{ maxWidth: '32rem' }}>
        <div className="col-4">
          <input
            className="form-control"
            placeholder="Media id"
            inputMode="numeric"
            value={mediaId}
            onChange={(event) => setMediaId(event.target.value)}
            aria-label="New image media id"
          />
        </div>
        <div className="col-6">
          <input
            className="form-control"
            placeholder="Caption (optional)"
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            aria-label="New image caption"
          />
        </div>
        <div className="col-2">
          <button
            type="button"
            className="btn btn-outline-secondary w-100"
            onClick={handleAdd}
            disabled={addImage.isPending}
          >
            <span className="bi bi-plus-lg" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
