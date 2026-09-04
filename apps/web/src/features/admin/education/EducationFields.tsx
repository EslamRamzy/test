'use client';

import { useFormContext } from 'react-hook-form';
import type { EducationFormValues } from './formSchema';

export function EducationFields(): React.JSX.Element {
  const {
    register,
    formState: { errors },
  } = useFormContext<EducationFormValues>();

  return (
    <>
      <div className="mb-3">
        <label htmlFor="field-institution" className="form-label">
          Institution
        </label>
        <input
          id="field-institution"
          className={`form-control${errors.institution ? ' is-invalid' : ''}`}
          {...register('institution')}
        />
        {errors.institution && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.institution.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-degree" className="form-label">
          Degree
        </label>
        <input
          id="field-degree"
          className={`form-control${errors.degree ? ' is-invalid' : ''}`}
          {...register('degree')}
        />
        {errors.degree && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.degree.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-field" className="form-label">
          Field of study
        </label>
        <input id="field-field" className="form-control" {...register('field')} />
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
          <div className="form-text">Leave blank if ongoing.</div>
          {errors.endDate && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.endDate.message}
            </div>
          )}
        </div>
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
