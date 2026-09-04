import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLE_PERMISSIONS, roleHasPermission } from './rbac.js';

describe('RBAC (docs/architecture/05)', () => {
  it('ADMIN is granted every permission except managing other users', () => {
    const adminPermissions = new Set(ROLE_PERMISSIONS['ADMIN']);

    expect(adminPermissions.has('user:create')).toBe(false);
    expect(adminPermissions.has('user:delete')).toBe(false);
    // Still allowed to read/update — e.g. its own account.
    expect(adminPermissions.has('user:read')).toBe(true);
    expect(adminPermissions.has('user:update')).toBe(true);
  });

  it('ADMIN can publish and reorder content', () => {
    expect(roleHasPermission('ADMIN', 'project:publish')).toBe(true);
    expect(roleHasPermission('ADMIN', 'project:reorder')).toBe(true);
    expect(roleHasPermission('ADMIN', 'article:publish')).toBe(true);
  });

  it('SUPER_ADMIN is granted literally everything, including user management', () => {
    expect(roleHasPermission('SUPER_ADMIN', 'user:create')).toBe(true);
    expect(roleHasPermission('SUPER_ADMIN', 'user:delete')).toBe(true);
  });

  it('EDITOR is reserved and grants nothing in v1', () => {
    expect(ROLE_PERMISSIONS['EDITOR']).toEqual([]);
    expect(roleHasPermission('EDITOR', 'project:read')).toBe(false);
  });

  it('every resource in PERMISSIONS has at least a read action', () => {
    for (const actions of Object.values(PERMISSIONS)) {
      expect(actions).toContain('read');
    }
  });

  it('audit is read-only for every role — no permission grants writing to it', () => {
    const auditPermissions = Object.keys(PERMISSIONS)
      .filter((resource) => resource === 'audit')
      .flatMap((resource) => PERMISSIONS[resource as keyof typeof PERMISSIONS]);

    expect(auditPermissions).toEqual(['read']);
  });

  it('rejects an invalid permission string at the type level (compile-time only)', () => {
    // @ts-expect-error — "project:destroy" is not a real action.
    const invalid: Parameters<typeof roleHasPermission>[1] = 'project:destroy';
    expect(invalid).toBeDefined();
  });
});
