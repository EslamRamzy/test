'use client';

import type { LoginInput } from '@portfolio/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@portfolio/shared';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ApiError } from '@/lib/api/ApiError';
import * as adminApi from '@/lib/api/adminClient';

/**
 * docs/architecture/04 §6/§8. Success does a full `window.location`
 * navigation, not `router.push` — the cookies a successful login just set
 * arrived via a plain `fetch` to the API's own origin, not through Next's
 * router, and a full navigation is what guarantees `proxy.ts` (which
 * reads those cookies) and the server-rendered `/admin` it redirects to
 * both see them, rather than relying on the client router's prefetch cache
 * to have picked up an auth change it has no way to know happened.
 *
 * `mustChangePassword` (doc 04 §8: "forces a change before anything else is
 * reachable") sends the user to `/admin/change-password` instead of the
 * dashboard — this is the ADMIN_INITIAL_PASSWORD bootstrap account's own
 * first login, not an edge case.
 *
 * `?reason=expired`/`?reason=password-changed` render as inline alerts
 * here, not a `useToast()` toast — a toast lives in React context, which a
 * full-navigation redirect (this component's own `window.location.href`
 * above, or `proxy.ts`'s expired-session redirect) wipes before the
 * destination page could ever render it. A message that must survive a
 * full navigation belongs in the URL, read back by whatever the
 * navigation lands on — exactly this pattern.
 */
export function LoginForm(): React.JSX.Element {
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const reason = searchParams.get('reason');
  const from = searchParams.get('from');
  const redirectTarget =
    from && from.startsWith('/admin') && from !== '/admin/login' ? from : '/admin';

  async function onSubmit(data: LoginInput): Promise<void> {
    setFormError(null);
    try {
      const { user } = await adminApi.login(data);
      window.location.href = user.mustChangePassword ? '/admin/change-password' : redirectTarget;
    } catch (error) {
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') {
        setFormError('Too many attempts. Please wait a few minutes and try again.');
      } else if (error instanceof ApiError && error.status === 401) {
        setFormError('Invalid email or password.');
      } else {
        setFormError('Something went wrong signing in. Please try again.');
      }
    }
  }

  return (
    <form onSubmit={(event) => void handleSubmit(onSubmit)(event)} noValidate>
      {reason === 'expired' && !formError && (
        <div className="alert alert-warning" role="status">
          Your session expired. Please sign in again.
        </div>
      )}
      {reason === 'password-changed' && !formError && (
        <div className="alert alert-success" role="status">
          Password updated. Please sign in with your new password.
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input
          type="email"
          id="email"
          className={`form-control${errors.email ? ' is-invalid' : ''}`}
          autoComplete="username"
          autoFocus
          {...register('email')}
        />
        {errors.email && (
          <div className="invalid-feedback" role="alert">
            {errors.email.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="password" className="form-label">
          Password
        </label>
        <input
          type="password"
          id="password"
          className={`form-control${errors.password ? ' is-invalid' : ''}`}
          autoComplete="current-password"
          {...register('password')}
        />
        {errors.password && (
          <div className="invalid-feedback" role="alert">
            {errors.password.message}
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
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
