'use client';

import { SKILL_LEVELS, type SkillCreateInput } from '@portfolio/shared';
import { useFormContext } from 'react-hook-form';
import { skillCategoriesHooks } from '@/features/admin/skillCategories/client';

/**
 * `categoryId` is required on create but excluded from `skillUpdateSchema`
 * (`skill.ts`'s own comment: "moving a skill to a different category is a
 * distinct, deliberate action this schema doesn't cover") — `disableCategory`
 * renders it read-only on the Edit page rather than omitting the field
 * entirely, so an editor can still SEE which category a skill belongs to.
 */
export function SkillFields({
  disableCategory = false,
}: {
  disableCategory?: boolean;
}): React.JSX.Element {
  const {
    register,
    formState: { errors },
  } = useFormContext<SkillCreateInput>();
  const categoriesQuery = skillCategoriesHooks.useList({ page: 1, pageSize: 50 });
  const categories = categoriesQuery.data?.items ?? [];

  return (
    <>
      <div className="mb-3">
        <label htmlFor="field-categoryId" className="form-label">
          Category
        </label>
        <select
          id="field-categoryId"
          className={`form-select${errors.categoryId ? ' is-invalid' : ''}`}
          disabled={disableCategory}
          {...register('categoryId', { valueAsNumber: true })}
        >
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        {errors.categoryId && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.categoryId.message}
          </div>
        )}
      </div>

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
        <label htmlFor="field-icon" className="form-label">
          Icon
        </label>
        <input id="field-icon" className="form-control" {...register('icon')} />
      </div>

      <div className="mb-3">
        <label htmlFor="field-description" className="form-label">
          Description
        </label>
        <textarea
          id="field-description"
          className="form-control"
          rows={3}
          {...register('description')}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="field-level" className="form-label">
          Level
        </label>
        <select id="field-level" className="form-select" {...register('level')}>
          {SKILL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level.charAt(0) + level.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </div>

      <div className="form-check mb-3">
        <input
          id="field-visible"
          type="checkbox"
          className="form-check-input"
          {...register('visible')}
        />
        <label htmlFor="field-visible" className="form-check-label">
          Visible on the public site
        </label>
      </div>
    </>
  );
}
