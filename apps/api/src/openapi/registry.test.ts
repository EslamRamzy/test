import { describe, expect, it } from 'vitest';
import { generateOpenApiDocument } from './registry.js';

describe('generateOpenApiDocument', () => {
  it('produces a valid-shaped 3.1 document with every public and auth path registered', () => {
    const document = generateOpenApiDocument();

    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toContain('Portfolio');

    const expectedPaths = [
      '/api/v1/profile',
      '/api/v1/stats',
      '/api/v1/home',
      '/api/v1/projects',
      '/api/v1/projects/{slug}',
      '/api/v1/projects/{slug}/related',
      '/api/v1/technologies',
      '/api/v1/skills',
      '/api/v1/articles',
      '/api/v1/articles/{slug}',
      '/api/v1/articles/categories',
      '/api/v1/tags',
      '/api/v1/security',
      '/api/v1/security/{slug}',
      '/api/v1/certifications',
      '/api/v1/experience',
      '/api/v1/education',
      '/api/v1/timeline',
      '/api/v1/social-links',
      '/api/v1/search',
      '/api/v1/sitemap-data',
      '/api/v1/contact',
      '/api/v1/analytics/view',
      '/api/v1/auth/csrf',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/logout',
      '/api/v1/auth/logout-all',
      '/api/v1/auth/me',
      '/api/v1/auth/change-password',
    ];

    for (const path of expectedPaths) {
      expect(document.paths).toHaveProperty(path);
    }
  });

  it('registers the real project list query parameters (not a hand-written duplicate)', () => {
    const document = generateOpenApiDocument();
    const getProjects = document.paths?.['/api/v1/projects']?.get;
    const paramNames = (getProjects?.parameters ?? []).map((param) =>
      'name' in param ? param.name : undefined,
    );

    expect(paramNames).toEqual(
      expect.arrayContaining([
        'page',
        'pageSize',
        'category',
        'technology',
        'featured',
        'securityTested',
        'sort',
        'order',
      ]),
    );
  });

  it('marks POST /contact with a request body derived from contactSchema', () => {
    const document = generateOpenApiDocument();
    const postContact = document.paths?.['/api/v1/contact']?.post;
    expect(postContact?.requestBody).toBeDefined();
  });

  it('marks logout-all, me, and change-password as requiring cookie auth', () => {
    const document = generateOpenApiDocument();
    for (const [path, method] of [
      ['/api/v1/auth/logout-all', 'post'],
      ['/api/v1/auth/me', 'get'],
      ['/api/v1/auth/change-password', 'post'],
    ] as const) {
      const operation = document.paths?.[path]?.[method];
      expect(operation?.security).toEqual([{ cookieAuth: [] }]);
    }
  });
});
