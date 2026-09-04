'use client';

import { useFormContext } from 'react-hook-form';
import type { TimelineEntryFormValues } from './formSchema';

export function TimelineFields(): React.JSX.Element {
  const {
    register,
    formState: { errors },
  } = useFormContext<TimelineEntryFormValues>();

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

      <div className="row">
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-entryDate" className="form-label">
            Date
          </label>
          <input
            id="field-entryDate"
            type="date"
            className={`form-control${errors.entryDate ? ' is-invalid' : ''}`}
            {...register('entryDate')}
          />
          {errors.entryDate && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.entryDate.message}
            </div>
          )}
        </div>
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-yearLabel" className="form-label">
            Year label
          </label>
          <input id="field-yearLabel" className="form-control" {...register('yearLabel')} />
          <div className="form-text">Optional display override, e.g. “2019 – 2021”.</div>
        </div>
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
        <label htmlFor="field-category" className="form-label">
          Category
        </label>
        <input id="field-category" className="form-control" {...register('category')} />
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
