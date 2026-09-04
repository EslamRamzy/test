import Link from 'next/link';

export function ContactCta(): React.JSX.Element {
  return (
    <section className="contact-cta">
      <div className="container text-center">
        <p className="contact-cta__eyebrow">Get in touch</p>
        <h2 className="contact-cta__statement">Have a project in mind?</h2>
        <p className="contact-cta__sub">
          Or a question about something built here — either way, I&rsquo;d like to hear from you.
        </p>
        <Link href="/contact" className="btn btn-primary btn-lg hero__cta">
          Contact Me
          <span className="bi bi-arrow-right ms-2" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
