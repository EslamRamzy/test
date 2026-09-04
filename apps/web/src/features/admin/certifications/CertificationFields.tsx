'use client';

import { useFormContext } from 'react-hook-form';
import type { CertificationFormValues } from './formSchema';

/**
 * `certificateMediaId` is a plain numeric id input, not a media picker —
 * doc07 §3's actual picker is Phase 9's own scope, not built yet. Still a
 * real, editable field rather than an omission: doc11's exit criterion
 * ("every field of every entity is editable from the UI") doesn't get a
 * pass just because the nicer control doesn't exist yet, and an admin who
 * already knows a `Media` row's id (from a direct API call, say) can set
 * it today.
 */
export function CertificationFields(): React.JSX.Element {
  const {
    register,
    formState: { errors },
  } = useFormContext<CertificationFormValues>();

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
        <label htmlFor="field-issuer" className="form-label">
          Issuer
        </label>
        <input
          id="field-issuer"
          className={`form-control${errors.issuer ? ' is-invalid' : ''}`}
          {...register('issuer')}
        />
        {errors.issuer && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.issuer.message}
          </div>
        )}
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
          <label htmlFor="field-issueDate" className="form-label">
            Issue date
          </label>
          <input
            id="field-issueDate"
            type="date"
            className={`form-control${errors.issueDate ? ' is-invalid' : ''}`}
            {...register('issueDate')}
          />
          {errors.issueDate && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.issueDate.message}
            </div>
          )}
        </div>
        <div className="col-sm-6 mb-3">
          <label htmlFor="field-expirationDate" className="form-label">
            Expiration date
          </label>
          <input
            id="field-expirationDate"
            type="date"
            className={`form-control${errors.expirationDate ? ' is-invalid' : ''}`}
            {...register('expirationDate')}
          />
          {errors.expirationDate && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.expirationDate.message}
            </div>
          )}
        </div>
      </div>

      <div className="mb-3">
        <label htmlFor="field-certificateMediaId" className="form-label">
          Certificate media id
        </label>
        <input
          id="field-certificateMediaId"
          inputMode="numeric"
          className={`form-control${errors.certificateMediaId ? ' is-invalid' : ''}`}
          {...register('certificateMediaId')}
        />
        <div className="form-text">
          The id of an existing Media row for the certificate image (no picker yet — Phase 9).
        </div>
        {errors.certificateMediaId && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.certificateMediaId.message}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label htmlFor="field-credentialUrl" className="form-label">
          Credential URL
        </label>
        <input
          id="field-credentialUrl"
          type="url"
          placeholder="https://…"
          className={`form-control${errors.credentialUrl ? ' is-invalid' : ''}`}
          {...register('credentialUrl')}
        />
        {errors.credentialUrl && (
          <div className="invalid-feedback d-block" role="alert">
            {errors.credentialUrl.message}
          </div>
        )}
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
