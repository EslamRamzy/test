'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { EntityForm } from '@/features/admin/components/EntityForm';
import { MediaPicker } from '@/features/admin/components/MediaPicker';
import { useEditResourceForm } from '@/features/admin/lib/useEditResourceForm';
import { useResourceFormSubmit } from '@/features/admin/lib/useResourceFormSubmit';
import { useProfile, useUpdateProfile } from '@/features/admin/profile/client';
import {
  profileFormSchema,
  toProfileWirePayload,
  type ProfileFormValues,
} from '@/features/admin/profile/formSchema';

/** `GET|PATCH /admin/profile` (doc07 §3: "Profile (name, headline, bio, avatar)") — a singleton, so this page has no List/New, only the one Edit form. */
export default function ProfilePage(): React.JSX.Element {
  const profileQuery = useProfile();
  const updateMutation = useUpdateProfile();

  const methods = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      fullName: '',
      headline: '',
      shortBio: '',
      fullBio: '',
      location: '',
      publicEmail: '',
      avatarMediaId: '',
      resumeMediaId: '',
      availableForWork: false,
    },
  });

  useEditResourceForm({
    itemQuery: profileQuery,
    methods,
    toFormValues: (row) => ({
      fullName: row.fullName,
      headline: row.headline ?? '',
      shortBio: row.shortBio ?? '',
      fullBio: row.fullBio ?? '',
      location: row.location ?? '',
      publicEmail: row.publicEmail ?? '',
      avatarMediaId: row.avatarMediaId ? String(row.avatarMediaId) : '',
      resumeMediaId: row.resumeMediaId ? String(row.resumeMediaId) : '',
      availableForWork: row.availableForWork,
    }),
  });

  const { onSubmit, busy } = useResourceFormSubmit({
    methods,
    mutateAsync: (payload: ProfileFormValues) =>
      updateMutation.mutateAsync(toProfileWirePayload(payload)),
    toPayload: (values) => values,
    successMessage: 'Profile updated.',
    redirectTo: '/admin/profile',
  });

  if (profileQuery.isPending) return <p className="text-body-secondary">Loading…</p>;
  if (profileQuery.isError)
    return <div className="alert alert-danger">Couldn’t load the profile.</div>;

  const {
    register,
    control,
    formState: { errors },
  } = methods;

  return (
    <div className="admin-resource-page">
      <h1 className="h4 mb-4">Profile</h1>
      <EntityForm methods={methods} onSubmit={onSubmit} busy={busy}>
        <div className="mb-3">
          <label htmlFor="field-fullName" className="form-label">
            Full name
          </label>
          <input
            id="field-fullName"
            className={`form-control${errors.fullName ? ' is-invalid' : ''}`}
            {...register('fullName')}
          />
          {errors.fullName && (
            <div className="invalid-feedback d-block" role="alert">
              {errors.fullName.message}
            </div>
          )}
        </div>

        <div className="mb-3">
          <label htmlFor="field-headline" className="form-label">
            Headline
          </label>
          <input id="field-headline" className="form-control" {...register('headline')} />
        </div>

        <div className="mb-3">
          <label htmlFor="field-shortBio" className="form-label">
            Short bio
          </label>
          <textarea
            id="field-shortBio"
            className="form-control"
            rows={2}
            {...register('shortBio')}
          />
        </div>

        <div className="mb-3">
          <label htmlFor="field-fullBio" className="form-label">
            Full bio
          </label>
          <textarea id="field-fullBio" className="form-control" rows={6} {...register('fullBio')} />
        </div>

        <div className="row">
          <div className="col-sm-6 mb-3">
            <label htmlFor="field-location" className="form-label">
              Location
            </label>
            <input id="field-location" className="form-control" {...register('location')} />
          </div>
          <div className="col-sm-6 mb-3">
            <label htmlFor="field-publicEmail" className="form-label">
              Public email
            </label>
            <input
              id="field-publicEmail"
              type="email"
              className={`form-control${errors.publicEmail ? ' is-invalid' : ''}`}
              {...register('publicEmail')}
            />
            {errors.publicEmail && (
              <div className="invalid-feedback d-block" role="alert">
                {errors.publicEmail.message}
              </div>
            )}
          </div>
        </div>

        <div className="row">
          <div className="col-sm-6 mb-3">
            <span className="form-label d-block">Avatar</span>
            <Controller
              name="avatarMediaId"
              control={control}
              render={({ field }) => (
                <MediaPicker
                  value={field.value ? Number(field.value) : null}
                  onChange={(mediaId) => field.onChange(mediaId !== null ? String(mediaId) : '')}
                  kind="AVATAR"
                  label="avatar"
                />
              )}
            />
            {errors.avatarMediaId && (
              <div className="text-danger small mt-1" role="alert">
                {errors.avatarMediaId.message}
              </div>
            )}
          </div>
          <div className="col-sm-6 mb-3">
            <span className="form-label d-block">Résumé</span>
            <Controller
              name="resumeMediaId"
              control={control}
              render={({ field }) => (
                <MediaPicker
                  value={field.value ? Number(field.value) : null}
                  onChange={(mediaId) => field.onChange(mediaId !== null ? String(mediaId) : '')}
                  kind="RESUME"
                  label="résumé"
                />
              )}
            />
            {errors.resumeMediaId && (
              <div className="text-danger small mt-1" role="alert">
                {errors.resumeMediaId.message}
              </div>
            )}
          </div>
        </div>

        <div className="form-check form-switch mb-3">
          <input
            type="checkbox"
            className="form-check-input"
            id="field-availableForWork"
            {...register('availableForWork')}
          />
          <label className="form-check-label" htmlFor="field-availableForWork">
            Available for work
          </label>
        </div>
      </EntityForm>
    </div>
  );
}
