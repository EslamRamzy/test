import type { PublicMediaRef } from '@portfolio/shared';

/**
 * Maps a `media` row to the shape the public API exposes it as. `url` is a
 * path, not an absolute URL — the file is served from the same origin as
 * the API (`https://api.eslamramzy.dev/uploads/*`, docs/architecture/01 §3),
 * and static serving of that path is Phase 9's job (media management); this
 * function only needs to describe WHERE a file will be, not serve it.
 */
export function toPublicMediaRef(media: {
  id: number;
  filename: string;
  altText: string | null;
  width: number | null;
  height: number | null;
}): PublicMediaRef {
  return {
    id: media.id,
    url: `/uploads/${media.filename}`,
    altText: media.altText,
    width: media.width,
    height: media.height,
  };
}

export function toPublicMediaRefOrNull(
  media: {
    id: number;
    filename: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  } | null,
): PublicMediaRef | null {
  return media ? toPublicMediaRef(media) : null;
}
