'use client';

import type { TechnologyCreateInput } from '@portfolio/shared';
import { useFormContext } from 'react-hook-form';

/** Shared by both the Create and Edit pages — `<EntityForm>`'s own `FormProvider` is what makes `useFormContext` work here without either page threading `register`/`errors` down itself. */
export function TechnologyFields(): React.JSX.Element {
  const {
    register,
    formState: { errors },
  } = useFormContext<TechnologyCreateInput>();

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

      <div className="mb-3">
        <label htmlFor="field-icon" className="form-label">
          Icon
        </label>
        <input id="field-icon" className="form-control" {...register('icon')} />
        <div className="form-text">An icon-font class name, e.g. “devicon-react-original”.</div>
      </div>

      <div className="mb-3">
        <label htmlFor="field-category" className="form-label">
          Category
        </label>
        <input id="field-category" className="form-control" {...register('category')} />
      </div>

      <div className="mb-3">
        <label htmlFor="field-websiteUrl" className="form-label">
          Website URL
        </label>
        <input
          id="field-websiteUrl"
          type="url"
          className={`form-control${errors.websiteUrl ? ' is-invalid' : ''}`}
          placeholder="https://…"
          {...register('websiteUrl')}
        />
        {errors.websiteUrl && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.websiteUrl.message}
          </div>
        )}
      </div>
    </>
  );
}
