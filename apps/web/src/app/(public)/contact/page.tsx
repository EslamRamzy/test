import type { Metadata } from 'next';
import { getProfile } from '@/lib/api/endpoints';
import { ContactForm } from '@/features/contact/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch.',
};

export default async function ContactPage() {
  const profile = await getProfile();

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-7">
          <h1 className="h2 mb-3">Contact</h1>
          <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
            Have a project in mind, or a question? Send a message below
            {profile?.publicEmail && (
              <>
                {' '}
                or email <a href={`mailto:${profile.publicEmail}`}>{profile.publicEmail}</a>
              </>
            )}
            .
          </p>
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
