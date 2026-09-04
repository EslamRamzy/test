import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthenticatedError } from '../errors/AppError.js';
import { authorize } from './authorize.js';

function mockReq(user?: { id: number; role: string; tokenVersion: number }) {
  return { user } as unknown as Request;
}

describe('authorize', () => {
  it('calls next() with no error when the role has the permission', () => {
    const req = mockReq({ id: 1, role: 'ADMIN', tokenVersion: 0 });
    const next = vi.fn() as NextFunction;

    authorize('project:read')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(ForbiddenError) when the role lacks the permission', () => {
    const req = mockReq({ id: 1, role: 'EDITOR', tokenVersion: 0 });
    const next = vi.fn() as NextFunction;

    authorize('project:delete')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('calls next(UnauthenticatedError) when req.user is missing', () => {
    const req = mockReq(undefined);
    const next = vi.fn() as NextFunction;

    authorize('project:read')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthenticatedError));
  });

  it('ADMIN cannot create or delete users (reserved for SUPER_ADMIN)', () => {
    const req = mockReq({ id: 1, role: 'ADMIN', tokenVersion: 0 });
    const next = vi.fn() as NextFunction;

    authorize('user:create')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });

  it('EDITOR has no permissions at all (reserved, unused in v1)', () => {
    const req = mockReq({ id: 1, role: 'EDITOR', tokenVersion: 0 });
    const next = vi.fn() as NextFunction;

    authorize('project:read')(req, {} as Response, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
