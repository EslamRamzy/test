import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  httpsUrlSchema,
  idSchema,
  paginationQuerySchema,
  slugSchema,
  webUrlSchema,
} from './primitives.js';
import { MAX_PAGE_SIZE } from '../constants/api.js';

describe('slugSchema', () => {
  it.each(['a', 'my-project', 'next-js-15', 'a1-b2-c3'])('accepts %s', (value) => {
    expect(slugSchema.parse(value)).toBe(value);
  });

  it.each([
    ['', 'empty'],
    ['My-Project', 'uppercase'],
    ['my--project', 'double hyphen'],
    ['-leading', 'leading hyphen'],
    ['trailing-', 'trailing hyphen'],
    ['my_project', 'underscore'],
    ['my project', 'space'],
    ['../etc/passwd', 'path traversal'],
  ])('rejects %s (%s)', (value) => {
    expect(slugSchema.safeParse(value).success).toBe(false);
  });
});

describe('httpsUrlSchema', () => {
  it('accepts an https url', () => {
    expect(httpsUrlSchema.parse('https://github.com/eslamramzy')).toBe(
      'https://github.com/eslamramzy',
    );
  });

  // These are the reason this schema parses with `URL` instead of a regex.
  it.each([
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    '  javascript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'http://example.com',
    'not a url',
    '//example.com',
  ])('rejects %s', (value) => {
    expect(httpsUrlSchema.safeParse(value).success).toBe(false);
  });
});

describe('webUrlSchema', () => {
  it('permits http for local development', () => {
    expect(webUrlSchema.safeParse('http://localhost:4000').success).toBe(true);
  });

  it('still rejects dangerous protocols', () => {
    expect(webUrlSchema.safeParse('javascript:alert(1)').success).toBe(false);
  });
});

describe('emailSchema', () => {
  it('normalises to lowercase and trims', () => {
    expect(emailSchema.parse('  Eslam@Example.COM ')).toBe('eslam@example.com');
  });

  it.each(['', 'not-an-email', 'a@b', '@example.com', 'a b@example.com'])('rejects %s', (value) => {
    expect(emailSchema.safeParse(value).success).toBe(false);
  });
});

describe('idSchema', () => {
  it('coerces a numeric route parameter', () => {
    expect(idSchema.parse('42')).toBe(42);
  });

  it.each(['0', '-1', '1.5', 'abc', ''])('rejects %s', (value) => {
    expect(idSchema.safeParse(value).success).toBe(false);
  });
});

describe('paginationQuerySchema', () => {
  it('applies defaults', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 12 });
  });

  it('clamps pageSize rather than rejecting it', () => {
    expect(paginationQuerySchema.parse({ pageSize: '1000' }).pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('rejects a non-positive page', () => {
    expect(paginationQuerySchema.safeParse({ page: '0' }).success).toBe(false);
  });
});
