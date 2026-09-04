import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/**
 * File-convention icon — Next auto-injects a `<link rel="icon">` pointing
 * here. Generated the same way as `opengraph-image.tsx`, so there's no
 * separate binary asset to keep in sync with the brand color.
 *
 * `public/favicon.ico` exists ALONGSIDE this, not instead of it: some
 * browsers (and Lighthouse's console-error check, which is how this was
 * caught) probe the literal `/favicon.ico` path directly regardless of
 * what the `<link>` tag says, and this route only ever serves at `/icon`.
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#2760e8',
        color: '#ffffff',
        fontSize: 22,
        fontWeight: 700,
        fontFamily: 'sans-serif',
        borderRadius: 6,
      }}
    >
      E
    </div>,
    size,
  );
}
