'use client';

import { useFormContext } from 'react-hook-form';
import type { CertificationFormValues } from './formSchema';

/**
 * No `certificateMediaId` field here — doc07 §3's "certificate" media
 * attaches through the media library, which is Phase 9's own scope, not
 * built yet. A documented trim, not an oversight: the field stays optional
 * server-side, so a certification created here today can have its media
 * attached later once that picker exists, with no migration needed.
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
