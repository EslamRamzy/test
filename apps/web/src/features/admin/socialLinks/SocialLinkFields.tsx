'use client';

import type { SocialLinkCreateInput } from '@portfolio/shared';
import { useFormContext } from 'react-hook-form';

export function SocialLinkFields(): React.JSX.Element {
  const {
    register,
    formState: { errors },
  } = useFormContext<SocialLinkCreateInput>();

  return (
    <>
      <div className="mb-3">
        <label htmlFor="field-platform" className="form-label">
          Platform
        </label>
        <input
          id="field-platform"
          className={`form-control${errors.platform ? ' is-invalid' : ''}`}
          placeholder="GitHub, LinkedIn, …"
          {...register('platform')}
        />
        {errors.platform && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.platform.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-label" className="form-label">
          Label
        </label>
        <input id="field-label" className="form-control" {...register('label')} />
        <div className="form-text">Optional display text override.</div>
      </div>

      <div className="mb-3">
        <label htmlFor="field-url" className="form-label">
          URL
        </label>
        <input
          id="field-url"
          type="url"
          placeholder="https://…"
          className={`form-control${errors.url ? ' is-invalid' : ''}`}
          {...register('url')}
        />
        {errors.url && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.url.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-icon" className="form-label">
          Icon
        </label>
        <input id="field-icon" className="form-control" {...register('icon')} />
      </div>

      <div className="form-check mb-3">
        <input
          id="field-enabled"
          type="checkbox"
          className="form-check-input"
          {...register('enabled')}
        />
        <label htmlFor="field-enabled" className="form-check-label">
          Enabled
        </label>
      </div>
    </>
  );
}
