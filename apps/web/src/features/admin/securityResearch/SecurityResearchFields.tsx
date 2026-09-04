'use client';

import { RESEARCH_CATEGORIES } from '@portfolio/shared';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { MarkdownEditor } from '@/features/admin/components/MarkdownEditor';
import { TagInput } from '@/features/admin/components/TagInput';
import type { SecurityResearchFormValues } from './formSchema';

export function SecurityResearchFields(): React.JSX.Element {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<SecurityResearchFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'references' });

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
        <div className="form-text">Lowercase words separated by single hyphens.</div>
        {errors.slug && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.slug.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-description" className="form-label">
          Description
        </label>
        <textarea
          id="field-description"
          className={`form-control${errors.description ? ' is-invalid' : ''}`}
          rows={2}
          {...register('description')}
        />
        <div className="form-text">A short description — required to publish.</div>
        {errors.description && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.description.message}
          </div>
        )}
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
            {RESEARCH_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.charAt(0) + category.slice(1).toLowerCase()}
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
            The id of an existing Media row (no picker yet — Phase 9). Required to publish.
          </div>
          {errors.coverMediaId && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.coverMediaId.message}
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
        <span className="form-label d-block" id="field-tagIds-label">
          Tags
        </span>
        <Controller
          control={control}
          name="tagIds"
          render={({ field }) => <TagInput value={field.value ?? []} onChange={field.onChange} />}
        />
      </div>

      <div className="mb-3">
        <span className="form-label d-block">References</span>
        {fields.map((field, index) => (
          <div className="row g-2 mb-2" key={field.id}>
            <div className="col-sm-5">
              <input
                className="form-control"
                placeholder="Label"
                aria-label={`Reference ${index + 1} label`}
                {...register(`references.${index}.label` as const)}
              />
            </div>
            <div className="col-sm-6">
              <input
                className="form-control"
                placeholder="https://…"
                aria-label={`Reference ${index + 1} URL`}
                {...register(`references.${index}.url` as const)}
              />
            </div>
            <div className="col-sm-1">
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={() => remove(index)}
                aria-label={`Remove reference ${index + 1}`}
              >
                <span className="bi bi-trash" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => append({ label: '', url: '' })}
        >
          <span className="bi bi-plus-lg" aria-hidden="true" /> Add reference
        </button>
      </div>

      <div className="mb-3">
        <Controller
          control={control}
          name="content"
          render={({ field }) => <MarkdownEditor value={field.value} onChange={field.onChange} />}
        />
        {errors.content && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.content.message}
          </div>
        )}
      </div>
    </>
  );
}
