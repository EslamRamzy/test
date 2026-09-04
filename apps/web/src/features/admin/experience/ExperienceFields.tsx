'use client';

import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { technologiesHooks } from '@/features/admin/technologies/client';
import type { ExperienceFormValues } from './formSchema';

export function ExperienceFields(): React.JSX.Element {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext<ExperienceFormValues>();
  const { fields, append, remove } = useFieldArray({ control, name: 'achievements' });
  const technologiesQuery = technologiesHooks.useList({ page: 1, pageSize: 50 });
  const technologies = technologiesQuery.data?.items ?? [];

  return (
    <>
      <div className="mb-3">
        <label htmlFor="field-position" className="form-label">
          Position
        </label>
        <input
          id="field-position"
          className={`form-control${errors.position ? ' is-invalid' : ''}`}
          {...register('position')}
        />
        {errors.position && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.position.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-organization" className="form-label">
          Organization
        </label>
        <input
          id="field-organization"
          className={`form-control${errors.organization ? ' is-invalid' : ''}`}
          {...register('organization')}
        />
        {errors.organization && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.organization.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-location" className="form-label">
          Location
        </label>
        <input id="field-location" className="form-control" {...register('location')} />
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

      <div className="row">
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-startDate" className="form-label">
            Start date
          </label>
          <input
            id="field-startDate"
            type="date"
            className={`form-control${errors.startDate ? ' is-invalid' : ''}`}
            {...register('startDate')}
          />
          {errors.startDate && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.startDate.message}
            </div>
          )}
        </div>
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-endDate" className="form-label">
            End date
          </label>
          <input
            id="field-endDate"
            type="date"
            className={`form-control${errors.endDate ? ' is-invalid' : ''}`}
            {...register('endDate')}
          />
          {errors.endDate && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.endDate.message}
            </div>
          )}
        </div>
      </div>

      <div className="form-check mb-3">
        <input
          id="field-isCurrent"
          type="checkbox"
          className="form-check-input"
          {...register('isCurrent')}
        />
        <label htmlFor="field-isCurrent" className="form-check-label">
          I currently work here
        </label>
      </div>

      <div className="mb-3">
        <span className="form-label d-block">Achievements</span>
        {fields.map((field, index) => (
          <div className="input-group mb-2" key={field.id}>
            <input
              className="form-control"
              aria-label={`Achievement ${index + 1}`}
              {...register(`achievements.${index}.text` as const)}
            />
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => remove(index)}
              aria-label={`Remove achievement ${index + 1}`}
            >
              <span className="bi bi-trash" aria-hidden="true" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          onClick={() => append({ text: '' })}
        >
          <span className="bi bi-plus-lg" aria-hidden="true" /> Add achievement
        </button>
      </div>

      <div className="mb-3">
        <span className="form-label d-block" id="field-technologyIds-label">
          Technologies
        </span>
        <Controller
          control={control}
          name="technologyIds"
          render={({ field }) => (
            <div
              className="d-flex flex-wrap gap-3"
              role="group"
              aria-labelledby="field-technologyIds-label"
            >
              {technologies.map((technology) => {
                const selected = field.value ?? [];
                const checked = selected.includes(technology.id);
                return (
                  <div className="form-check" key={technology.id}>
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={`field-technology-${technology.id}`}
                      checked={checked}
                      onChange={(event) => {
                        field.onChange(
                          event.target.checked
                            ? [...selected, technology.id]
                            : selected.filter((id) => id !== technology.id),
                        );
                      }}
                    />
                    <label
                      htmlFor={`field-technology-${technology.id}`}
                      className="form-check-label"
                    >
                      {technology.name}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        />
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
