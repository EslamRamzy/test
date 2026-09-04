'use client';

import { useRef, useState } from 'react';
import { submitContact } from '@/lib/api/client';
import { ApiError } from '@/lib/api/ApiError';

type Status = 'idle' | 'submitting' | 'success' | 'error';

/**
 * The honeypot field (`website`) is visually hidden via CSS, not
 * `type="hidden"` — a hidden INPUT is what an unsophisticated scraping bot
 * skips filling; a real one, styled off-screen but still a normal text
 * field to assistive tech that ignores CSS, would just get read aloud to
 * a screen-reader user for no reason, so it also carries `aria-hidden` and
 * `tabIndex={-1}` to stay fully out of that experience too.
 */
export function ContactForm(): React.JSX.Element {
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const renderedAtRef = useRef(Date.now());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setStatus('submitting');
    setErrorMessage(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await submitContact({
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        subject: data.get('subject') ? String(data.get('subject')) : undefined,
        message: String(data.get('message') ?? ''),
        website: String(data.get('website') ?? ''),
        renderedAt: renderedAtRef.current,
      });
      setStatus('success');
      form.reset();
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof ApiError && error.code === 'VALIDATION_ERROR'
          ? 'Please check the form for errors and try again.'
          : 'Something went wrong sending your message. Please try again in a moment.',
      );
    }
  }

  if (status === 'success') {
    return (
      <div className="alert alert-success" role="status">
        <span className="bi bi-check-circle me-2" aria-hidden="true" />
        Thanks — your message has been sent.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: '-9999px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        <label htmlFor="website">Leave this field empty</label>
        <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="mb-3">
        <label htmlFor="name" className="form-label">
          Name
        </label>
        <input
          type="text"
          className="form-control"
          id="name"
          name="name"
          minLength={2}
          maxLength={100}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="email" className="form-label">
          Email
        </label>
        <input
          type="email"
          className="form-control"
          id="email"
          name="email"
          maxLength={254}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="subject" className="form-label">
          Subject <span style={{ color: 'var(--color-text-muted)' }}>(optional)</span>
        </label>
        <input
          type="text"
          className="form-control"
          id="subject"
          name="subject"
          minLength={3}
          maxLength={150}
        />
      </div>

      <div className="mb-3">
        <label htmlFor="message" className="form-label">
          Message
        </label>
        <textarea
          className="form-control"
          id="message"
          name="message"
          rows={6}
          minLength={10}
          maxLength={5000}
          required
        />
      </div>

      {status === 'error' && errorMessage && (
        <div className="alert alert-danger" role="alert" aria-live="polite">
          {errorMessage}
        </div>
      )}

      <button type="submit" className="btn btn-primary" disabled={status === 'submitting'}>
        {status === 'submitting' ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
