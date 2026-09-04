import Link from 'next/link';

export function ContactCta(): React.JSX.Element {
  return (
    <section className="py-5 text-center">
      <div className="container">
        <h2 className="h3 mb-3">Let&apos;s work together</h2>
        <p className="mb-4" style={{ color: 'var(--color-text-muted)' }}>
          Have a project in mind, or a question about something built here? Get in touch.
        </p>
        <Link href="/contact" className="btn btn-primary btn-lg">
          Contact Me
        </Link>
      </div>
    </section>
  );
}
