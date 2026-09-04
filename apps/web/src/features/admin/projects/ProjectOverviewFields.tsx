'use client';

import { PROJECT_CATEGORIES } from '@portfolio/shared';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { ProjectFormValues } from './formSchema';

export function ProjectOverviewFields(): React.JSX.Element {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ProjectFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'features' });

  return (
    <>
      <div className="mb-3">
        <label htmlFor="field-title" className="form-label">
          Title
        </label>
        <input
          id="field-title"
          className={`form-control${errors.title ? ' is-invalid' : ''}`}
          {...register('title')}
        />
        {errors.title && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.title.message}
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
        {errors.slug && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.slug.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-shortDescription" className="form-label">
          Short description
        </label>
        <textarea
          id="field-shortDescription"
          className={`form-control${errors.shortDescription ? ' is-invalid' : ''}`}
          rows={2}
          {...register('shortDescription')}
        />
        {errors.shortDescription && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.shortDescription.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-fullDescription" className="form-label">
          Full description
        </label>
        <textarea
          id="field-fullDescription"
          className="form-control"
          rows={4}
          {...register('fullDescription')}
        />
      </div>

      <div className="row">
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-category" className="form-label">
            Category
          </label>
          <select
            id="field-category"
            className={`form-select${errors.category ? ' is-invalid' : ''}`}
            {...register('category')}
          >
            {PROJECT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          {errors.category && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.category.message}
            </div>
          )}
        </div>
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-coverMediaId" className="form-label">
            Cover media id
          </label>
          <input
            id="field-coverMediaId"
            inputMode="numeric"
            className={`form-control${errors.coverMediaId ? ' is-invalid' : ''}`}
            {...register('coverMediaId')}
          />
          <div className="form-text">
            The id of an existing Media row (no picker yet — Phase 9).
          </div>
          {errors.coverMediaId && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.coverMediaId.message}
            </div>
          )}
        </div>
      </div>

      <div className="row">
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-githubUrl" className="form-label">
            GitHub URL
          </label>
          <input
            id="field-githubUrl"
            type="url"
            placeholder="https://…"
            className={`form-control${errors.githubUrl ? ' is-invalid' : ''}`}
            {...register('githubUrl')}
          />
          {errors.githubUrl && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.githubUrl.message}
            </div>
          )}
        </div>
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-liveUrl" className="form-label">
            Live URL
          </label>
          <input
            id="field-liveUrl"
            type="url"
            placeholder="https://…"
            className={`form-control${errors.liveUrl ? ' is-invalid' : ''}`}
            {...register('liveUrl')}
          />
          {errors.liveUrl && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.liveUrl.message}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="field-publishedAt" className="form-label">
          Scheduled publish date
        </label>
        <input
          id="field-publishedAt"
          type="datetime-local"
          className={`form-control${errors.publishedAt ? ' is-invalid' : ''}`}
          {...register('publishedAt')}
        />
        {errors.publishedAt && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.publishedAt.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <span className="form-label d-block">Features</span>
        {fields.map((field, index) => (
          <div className="row g-2 mb-2" key={field.id}>
            <div className="col-sm-4">
              <input
                className="form-control"
                placeholder="Title"
                aria-label={`Feature ${index + 1} title`}
                {...register(`features.${index}.title` as const)}
              />
            </div>
            <div className="col-sm-7">
              <input
                className="form-control"
                placeholder="Description"
                aria-label={`Feature ${index + 1} description`}
                {...register(`features.${index}.description` as const)}
              />
            </div>
            <div className="col-sm-1">
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => remove(index)}
                aria-label={`Remove feature ${index + 1}`}
              >
                <span className="bi bi-trash" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => append({ title: '', description: '' })}
        >
          <span className="bi bi-plus-lg" aria-hidden="true" /> Add feature
        </button>
      </div>
    </>
  );
}
