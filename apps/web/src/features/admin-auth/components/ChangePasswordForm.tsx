'use client';

import type { ChangePasswordInput } from '@portfolio/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema } from '@portfolio/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError } from '@/lib/api/ApiError';
import * as adminApi from '@/lib/api/adminClient';

/**
 * docs/architecture/04 §8: the bootstrap account is flagged
 * `must_change_password`, and "the admin UI forces a change before
 * anything else is reachable" — `LoginForm` routes here instead of the
 * dashboard whenever `mustChangePassword` comes back true, and
 * `proxy.ts` still gates this route the same as every other
 * `/admin/*` page (an access-token cookie must be present).
 *
 * `changePassword` revokes every session, this one included
 * (`authController.changePassword`'s own comment) — success can only mean
 * "sign in again," so this redirects to `/admin/login`, not `/admin`.
 */
export function ChangePasswordForm(): React.JSX.Element {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordInput>({ resolver: zodResolver(changePasswordSchema) });

  async function onSubmit(data: ChangePasswordInput): Promise<void> {
    setFormError(null);
    try {
      await adminApi.changePassword(data);
      window.location.href = '/admin/login?reason=password-changed';
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError('Current password is incorrect.');
      } else if (error instanceof ApiError && error.code === 'VALIDATION_ERROR') {
        setFormError('That new password does not meet the requirements below.');
      } else {
        setFormError('Something went wrong changing your password. Please try again.');
      }
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      <div className="mb-3">
        <label htmlFor="currentPassword" className="form-label">
          Current password
        </label>
        <input
          type="password"
          id="currentPassword"
          className={`form-control${errors.currentPassword ? ' is-invalid' : ''}`}
          autoComplete="current-password"
          autoFocus
          {...register('currentPassword')}
        />
        {errors.currentPassword && (
          <div className="invalid-feedback" role="alert">
            {errors.currentPassword.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="newPassword" className="form-label">
          New password
        </label>
        <input
          type="password"
          id="newPassword"
          className={`form-control${errors.newPassword ? ' is-invalid' : ''}`}
          autoComplete="new-password"
          {...register('newPassword')}
        />
        <div className="form-text">At least 12 characters. Not a common password.</div>
        {errors.newPassword && (
          <div className="invalid-feedback" role="alert">
            {errors.newPassword.message}
          </div>
        )}
      </div>

      {formError && (
        <div className="alert alert-danger" role="alert" aria-live="polite">
          {formError}
        </div>
      )}

      <button type="submit" className="btn btn-primary w-100" disabled={isSubmitting}>
        {isSubmitting && (
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          />
        )}
        {isSubmitting ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
