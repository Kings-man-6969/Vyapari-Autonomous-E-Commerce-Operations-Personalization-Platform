/**
 * EnquiryForm — the one capture point for all three sources in section H1.
 *
 * A contact form, a product enquiry and a store enquiry are the same form with a
 * different `source` and a different routing field, so they are one component.
 * Three copies would be three places to forget the honeypot, three copies of the
 * "email or phone" rule, and three different ideas of what a failure looks like.
 *
 * Three things worth knowing:
 *
 *  * **It does not trust its own validation.** The email and phone format rules
 *    live on the server (`app/routers/leads.py`) and are mirrored here only to
 *    save a round trip. When the server rejects something anyway, its message is
 *    what the customer sees -- a second opinion that disagrees with the first is
 *    worse than no second opinion.
 *
 *  * **The honeypot is a real field, hidden with CSS.** `display: none` is
 *    skipped by some bots; a field positioned off-screen with `aria-hidden` and
 *    `tabIndex={-1}` is invisible to a person and present to a scraper, which is
 *    the whole point. The server answers a filled honeypot exactly like a real
 *    submission.
 *
 *  * **Success is terminal.** The form is replaced by the confirmation rather
 *    than cleared, because a cleared form with a green message is
 *    indistinguishable from a form that never sent, and the customer sends it
 *    again.
 */
import React, { useState } from 'react';
import { Mail, Phone, User, MessageSquare, CheckCircle2, AlertTriangle, Send } from 'lucide-react';
import api from '../services/api';

const FIELD_STYLE = {
  backgroundColor: 'var(--color-obsidian-graphite)',
  borderColor: 'var(--color-border-steel)'
};

/**
 * A loose mirror of the server's rule, to save a round trip. Exported so the
 * render suite can assert the cases where it deliberately differs from a
 * stricter pattern: an address without a dot in the domain is rejected, but
 * everything the server accepts must not be blocked here, because a form that
 * refuses a real address loses the enquiry and the server never sees it.
 */
export const looksLikeEmail = (v) => !v || /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(v.trim());

export function EnquiryForm({
  source,
  productId = null,
  sellerId = null,
  heading = 'Send us a message',
  intro = null,
  submitLabel = 'Send message',
  compact = false,
  onSent = null
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  // The honeypot. A person never sees it; a script fills every input it finds.
  const [website, setWebsite] = useState('');

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() && !phone.trim()) {
      setError('Please give us an email address or a phone number so we can reply.');
      return;
    }
    if (!looksLikeEmail(email)) {
      setError('That does not look like an email address.');
      return;
    }

    setSending(true);
    try {
      const payload = {
        source,
        name: name.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        message: message.trim() || null,
        website
      };
      if (source === 'product_enquiry') payload.product_id = productId;
      if (source === 'seller_page') payload.seller_id = sellerId;

      const res = await api.post('/leads', payload);
      if (res.data?.success) {
        setSent(true);
        if (onSent) onSent(res.data.data);
      } else {
        setError('We could not send that. Please try again.');
      }
    } catch (err) {
      // The server's own message wins when there is one. It is the only thing
      // that can say *which* field it disliked.
      const detail = err?.response?.data?.error || err?.response?.data;
      setError(detail?.message || 'We could not send that. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--color-border-steel)',
          backgroundColor: 'var(--color-gunmetal-dark)'
        }}
        role="status"
      >
        <CheckCircle2 size={20} color="var(--color-icy-steel)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#ffffff' }}>
            Thanks — we will be in touch.
          </div>
          <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', margin: '6px 0 0' }}>
            {email.trim()
              ? `We'll reply to ${email.trim()}.`
              : "We'll call you back on the number you gave us."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: compact ? '12px' : '16px' }}
    >
      {heading && (
        <h3 style={{ fontSize: compact ? '15px' : '18px', fontWeight: 600, color: '#ffffff', margin: 0 }}>
          {heading}
        </h3>
      )}
      {intro && (
        <p style={{ fontSize: '12px', color: 'var(--color-steel-mist)', margin: 0, lineHeight: 1.55 }}>
          {intro}
        </p>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #7f1d1d',
            backgroundColor: '#2a1215',
            color: '#fecaca',
            fontSize: '12px'
          }}
          role="alert"
        >
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      <Field icon={<User size={15} />} label="Your name">
        <input
          type="text"
          className="input-field"
          style={{ ...FIELD_STYLE, paddingLeft: '36px' }}
          placeholder="Optional"
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>

      <div style={{ display: 'grid', gridTemplateColumns: compact ? '1fr' : '1fr 1fr', gap: '12px' }}>
        <Field icon={<Mail size={15} />} label="Email">
          <input
            type="email"
            className="input-field"
            style={{ ...FIELD_STYLE, paddingLeft: '36px' }}
            placeholder="you@example.com"
            maxLength={150}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field icon={<Phone size={15} />} label="Phone">
          <input
            type="tel"
            className="input-field"
            style={{ ...FIELD_STYLE, paddingLeft: '36px' }}
            placeholder="Optional"
            maxLength={20}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </Field>
      </div>

      <Field icon={<MessageSquare size={15} />} label="Message" alignTop>
        <textarea
          className="input-field"
          style={{ ...FIELD_STYLE, paddingLeft: '36px', minHeight: compact ? '72px' : '110px', resize: 'vertical' }}
          placeholder={
            source === 'product_enquiry'
              ? 'Ask about availability, sizing, delivery…'
              : source === 'seller_page'
                ? 'Ask this store a question…'
                : 'How can we help?'
          }
          maxLength={4000}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
      </Field>

      {/* The honeypot. Off-screen rather than `display: none`, because some
          scrapers skip hidden elements and all of them fill visible inputs. */}
      <div
        aria-hidden="true"
        style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}
      >
        <label htmlFor="lead-website">Website (leave this empty)</label>
        <input
          id="lead-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <button
          type="submit"
          className="btn-primary"
          disabled={sending}
          style={{ padding: '11px 24px', fontSize: '13px', opacity: sending ? 0.6 : 1, cursor: sending ? 'wait' : 'pointer' }}
        >
          {sending ? 'Sending…' : submitLabel} <Send size={14} />
        </button>
        <span style={{ fontSize: '11px', color: 'var(--color-ash-label)' }}>
          Email or phone — either is enough. We use it only to reply.
        </span>
      </div>
    </form>
  );
}

function Field({ icon, label, children, alignTop = false }) {
  return (
    <div>
      <label className="form-label" style={{ display: 'block', marginBottom: '6px', fontSize: '12px' }}>
        {label}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: alignTop ? 'flex-start' : 'center' }}>
        <span
          style={{
            position: 'absolute',
            left: '12px',
            top: alignTop ? '13px' : '50%',
            transform: alignTop ? 'none' : 'translateY(-50%)',
            color: 'var(--color-ash-label)',
            display: 'flex'
          }}
        >
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

export default EnquiryForm;
