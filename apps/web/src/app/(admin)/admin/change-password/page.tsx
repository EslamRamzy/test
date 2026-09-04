import type { Metadata } from 'next';
import { ChangePasswordForm } from '@/features/admin-auth/components/ChangePasswordForm';

export const metadata: Metadata = { title: 'Change password' };

export default function AdminChangePasswordPage(): React.JSX.Element {
  return (
    <div className="admin-auth">
      <div className="admin-auth__card">
        <div className="admin-auth__brand">
          <span className="admin-auth__brand-dot" aria-hidden="true" />
          Eslam Ramzy — Admin
        </div>
        <h1 className="admin-auth__title">Set a new password</h1>
        <p className="text-body-secondary mb-4" style={{ fontSize: '0.9rem' }}>
          You must set a new password before continuing.
        </p>
        <ChangePasswordForm />
      </div>
    </div>
  );
}
