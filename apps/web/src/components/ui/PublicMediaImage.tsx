import type { PublicMediaRef } from '@portfolio/shared';
import Image from 'next/image';
import { getApiBaseUrl } from '@/lib/config';

/**
 * `media.url` from the API is a path (`/uploads/xyz.jpg`), not an absolute
 * URL — `lib/mediaUrl.ts` on the API side deliberately keeps it origin-
 * agnostic (see that file's own comment). This is the one place the public
 * API origin gets prefixed onto it for `next/image`, which needs an
 * absolute URL for any remote (non-same-origin) image.
 */
export function PublicMediaImage({
  media,
  className,
  sizes,
  priority,
  fill,
  width,
  height,
}: {
  media: PublicMediaRef;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fill?: boolean;
  width?: number;
  height?: number;
}): React.JSX.Element {
  const src = `${getApiBaseUrl()}${media.url}`;
  const alt = media.altText ?? '';

  // `next/image`'s own prop types are `exactOptionalPropertyTypes`-strict —
  // `priority?: boolean` rejects an explicit `priority={undefined}` — so
  // optional props are spread in only when actually provided, rather than
  // always passed through with a possibly-undefined value.
  const optionalProps = {
    ...(className !== undefined ? { className } : {}),
    ...(priority !== undefined ? { priority } : {}),
  };

  if (fill) {
    return <Image src={src} alt={alt} fill sizes={sizes ?? '100vw'} {...optionalProps} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width ?? media.width ?? 800}
      height={height ?? media.height ?? 600}
      {...(sizes !== undefined ? { sizes } : {})}
      {...optionalProps}
    />
  );
}
