'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { MarkdownEditor } from '@/features/admin/components/MarkdownEditor';
import { TagInput } from '@/features/admin/components/TagInput';
import { articleCategoriesHooks } from '@/features/admin/articleCategories/client';
import type { ArticleFormValues } from './formSchema';

export function ArticleFields(): React.JSX.Element {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ArticleFormValues>();
  const categoriesQuery = articleCategoriesHooks.useList({ page: 1, pageSize: 50 });
  const categories = categoriesQuery.data?.items ?? [];

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
        <label htmlFor="field-excerpt" className="form-label">
          Excerpt
        </label>
        <textarea
          id="field-excerpt"
          className={`form-control${errors.excerpt ? ' is-invalid' : ''}`}
          rows={2}
          {...register('excerpt')}
        />
        <div className="form-text">A short description — required to publish.</div>
        {errors.excerpt && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.excerpt.message}
          </div>
        )}
      </div>

      <div className="row">
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-categoryId" className="form-label">
            Category
          </label>
          <select
            id="field-categoryId"
            className={`form-select${errors.categoryId ? ' is-invalid' : ''}`}
            {...register('categoryId')}
          >
            <option value="">— none —</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <div className="form-text">Required to publish.</div>
          {errors.categoryId && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.categoryId.message}
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
        <div className="form-text">
          May be set in the future — the public site only shows an article once this date has
          arrived.
        </div>
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
