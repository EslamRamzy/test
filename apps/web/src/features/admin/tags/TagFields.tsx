'use client';

import type { TagCreateInput } from '@portfolio/shared';
import { useFormContext } from 'react-hook-form';

export function TagFields(): React.JSX.Element {
  const {
    register,
    formState: { errors },
  } = useFormContext<TagCreateInput>();

  return (
    <>
      <div className="mb-3">
        <label htmlFor="field-name" className="form-label">
          Name
        </label>
        <input
          id="field-name"
          className={`form-control${errors.name ? ' is-invalid' : ''}`}
          {...register('name')}
        />
        {errors.name && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.name.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-slug" className="form-label">
          Slug
        </label>
        <input
          id="field-slug"
          className={`form-control${errors.slug ? ' is-invalid' : ''}`}
          {...register('slug')}
        />
        <div className="form-text">Lowercase words separated by single hyphens.</div>
        {errors.slug && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.slug.message}
          </div>
        )}
      </div>
    </>
  );
}
