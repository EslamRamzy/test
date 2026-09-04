import type { Metadata } from 'next';
import { getProfile } from '@/lib/api/endpoints';
import { ContactForm } from '@/features/contact/components/ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'Get in touch.',
};

/**
 * A statement, then a form (design concept §17) — asymmetric, matching the
 * Hero: the "ask" on one side, the form doing the work on the other.
 */
export default async function ContactPage() {
  const profile = await getProfile();

  return (
    <div className="container contact-page">
      {/* No `g-*` gutter utility — see Hero.tsx's comment: it overflows past
          `.container`'s own fixed padding at narrow viewports (confirmed at
          320px, the same bug already found and fixed on the homepage). */}
      <div className="row g-4 g-lg-5 align-items-start">
        <div className="col-lg-5">
          <h1 className="contact-page__statement">
            Have a project
            <br />
            in mind?
          </h1>
          <p className="contact-page__sub">
            Send a message and I&rsquo;ll get back to you
            {profile?.publicEmail && (
              <>
                {' '}
                — or reach me directly at{' '}
                <a
                  href={`mailto:${profile.publicEmail}`}
                  className="section-link"
                  style={{ display: 'inline' }}
                >
                  {profile.publicEmail}
                </a>
              </>
            )}
            .
          </p>
        </div>
        <div className="col-lg-7">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}
