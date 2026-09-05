import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { UnsupportedMediaTypeError } from '../errors/AppError.js';
import { processUpload, sanitizeOriginalName } from './mediaProcessing.js';

/** A tiny real PNG — a solid 4x3 red square, encoded through sharp itself. */
async function makePngFixture(): Promise<Buffer> {
  return sharp({
    create: { width: 4, height: 3, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
}

/**
 * A JPEG carrying real EXIF orientation (6 = rotate 90° CW) plus a GPS tag —
 * exactly the "camera metadata" doc09 §7 says a re-encode must strip.
 * `withMetadata` is what actually embeds it into the OUTPUT here; the
 * pipeline under test never calls `withMetadata` itself, which is the
 * property being verified.
 */
async function makeJpegFixtureWithExif(): Promise<Buffer> {
  return sharp({
    create: { width: 6, height: 4, channels: 3, background: { r: 0, g: 128, b: 255 } },
  })
    .jpeg()
    .withMetadata({ orientation: 6, exif: { IFD0: { Make: 'ExampleCam' } } })
    .toBuffer();
}

describe('processUpload', () => {
  it('accepts a real PNG and returns its dimensions', async () => {
    const result = await processUpload(await makePngFixture());
    expect(result.mimeType).toBe('image/png');
    expect(result.extension).toBe('png');
    expect(result.width).toBe(4);
    expect(result.height).toBe(3);
  });

  it('re-encodes a JPEG and strips EXIF (orientation applied, then discarded)', async () => {
    const original = await makeJpegFixtureWithExif();
    const originalMeta = await sharp(original).metadata();
    expect(originalMeta.exif).toBeDefined();
    expect(originalMeta.orientation).toBe(6);

    const result = await processUpload(original);
    expect(result.mimeType).toBe('image/jpeg');

    const outputMeta = await sharp(result.buffer).metadata();
    expect(outputMeta.exif).toBeUndefined();
    // Orientation 6 on a 6x4 source rotates to 4x6 — proof the auto-orient
    // step actually ran (rather than metadata simply being dropped as-is,
    // which would leave the image sideways with no tag to say so).
    expect(outputMeta.width).toBe(4);
    expect(outputMeta.height).toBe(6);
    expect(outputMeta.orientation).toBeUndefined();
  });

  it('trusts real bytes over a claimed type — a genuine PNG is accepted regardless of caller intent', async () => {
    // processUpload only ever sees the buffer, never a client Content-Type —
    // this asserts the acceptance path itself, the "doctored header is
    // ignored" half is exercised at the route level (the controller never
    // reads req.file.mimetype for validation).
    const result = await processUpload(await makePngFixture());
    expect(result.mimeType).toBe('image/png');
  });

  it('accepts a real PDF unmodified, with null dimensions', async () => {
    const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< >>\nendobj\n%%EOF');
    const result = await processUpload(pdfBuffer);
    expect(result.mimeType).toBe('application/pdf');
    expect(result.extension).toBe('pdf');
    expect(result.width).toBeNull();
    expect(result.height).toBeNull();
    expect(result.buffer).toEqual(pdfBuffer);
  });

  it('rejects SVG (no magic bytes to detect — an XML-based XSS vector)', async () => {
    const svgBuffer = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    await expect(processUpload(svgBuffer)).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
  });

  it('rejects a .php-style text payload', async () => {
    const phpBuffer = Buffer.from('<?php system($_GET["c"]); ?>');
    await expect(processUpload(phpBuffer)).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
  });

  it('rejects a Windows PE executable (MZ header)', async () => {
    const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    await expect(processUpload(exeBuffer)).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
  });

  it('rejects an empty buffer', async () => {
    await expect(processUpload(Buffer.alloc(0))).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
  });

  it('rejects a genuine image format outside the allow-list (GIF)', async () => {
    const gifBuffer = await sharp({
      create: { width: 2, height: 2, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .gif()
      .toBuffer();
    await expect(processUpload(gifBuffer)).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
  });
});

describe('sanitizeOriginalName', () => {
  it('keeps a normal filename as-is', () => {
    expect(sanitizeOriginalName('photo.jpg')).toBe('photo.jpg');
  });

  it('strips a directory-traversal path down to the basename', () => {
    expect(sanitizeOriginalName('../../etc/passwd')).toBe('passwd');
  });

  it('strips a Windows-style traversal path down to the basename', () => {
    expect(sanitizeOriginalName('..\\..\\windows\\system32\\config')).toBe('config');
  });

  it('removes characters outside the safe display set', () => {
    expect(sanitizeOriginalName('evil<script>.jpg')).toBe('evilscript.jpg');
  });

  it('falls back to "file" for an empty or fully-stripped name', () => {
    expect(sanitizeOriginalName('')).toBe('file');
    expect(sanitizeOriginalName('///')).toBe('file');
  });

  it('truncates a very long name', () => {
    const longName = `${'a'.repeat(400)}.jpg`;
    expect(sanitizeOriginalName(longName).length).toBeLessThanOrEqual(255);
  });
});
